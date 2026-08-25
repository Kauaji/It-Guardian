import { badRequest, conflict, notFoundError } from "../lib/errors.js";
import {
  createNetworkTopologyLink,
  createNetworkTopologyMap,
  createNetworkTopologyNode,
  deleteNetworkTopologyLink,
  deleteNetworkTopologyMap,
  deleteNetworkTopologyNode,
  bulkUpdateNetworkTopologyNodePositions,
  getNetworkTopologyMap,
  getOrCreateNetworkTopologyMapByScope,
  listNetworkTopologyLinks,
  listNetworkTopologyMaps,
  listNetworkTopologyNodes,
  updateNetworkTopologyLink,
  updateNetworkTopologyMap,
  updateNetworkTopologyNode
} from "../repositories/networkTopologyRepository.js";
import { findSegmentById } from "../repositories/segmentRepository.js";
import { findSegmentGroupById } from "../repositories/segmentGroupRepository.js";
import { computeAutoLayout } from "./networkTopologyAutoLayout.js";
import { broadcastSnapshot } from "./realtimeService.js";

// "Aba" nao tem tabela propria no banco (e um conceito 100% client-side, em
// localStorage - inventoryTabRepository.js existe no codigo mas referencia
// uma coluna tab_id que nao existe no schema, nunca foi montado em app.js).
// Por isso o escopo inventory_tab nao entra em SCOPE_LOOKUPS: nao ha entidade
// pra buscar/validar. getMapByScope trata esse escopo num ramo a parte,
// confiando no id (e no nome, mandado pelo cliente) sem checagem de FK - a
// mesma politica ja usada por floor_plans.inventory_tab_id hoje.
const SCOPE_LOOKUPS = {
  segment: { find: findSegmentById, notFoundMessage: "Segmento nao encontrado." },
  group: { find: findSegmentGroupById, notFoundMessage: "Grupo nao encontrado." }
};

// Subconjunto de SCOPE_LOOKUPS valido pra um no/ligacao do mapa (nao inclui
// inventory_tab - uma aba nao vira no dentro de outro mapa, so e o escopo do
// mapa do nivel Aba em si).
const NODE_REF_LOOKUPS = { segment: SCOPE_LOOKUPS.segment, group: SCOPE_LOOKUPS.group };

const CENTRAL_ASSET_TYPES = new Set(["server", "switch", "router", "nas"]);

async function ensureNodeRefExists(nodeType, refId) {
  if (!nodeType || nodeType === "asset") return; // ativo: ja validado pelo repository (ensureAssetsExist)
  const lookup = NODE_REF_LOOKUPS[nodeType];
  if (!lookup) return;
  const entity = await lookup.find(refId);
  if (!entity) {
    throw notFoundError(lookup.notFoundMessage);
  }
}

function notifySnapshot(context) {
  broadcastSnapshot().catch((error) => {
    console.error(`Realtime broadcast failed after ${context}`, error);
  });
}

async function withDuplicateRemap(action, message) {
  try {
    return await action();
  } catch (error) {
    if (error.code === "23505") {
      throw conflict(message);
    }
    throw error;
  }
}

export async function listMaps() {
  return listNetworkTopologyMaps();
}

export async function getMapWithNodesAndLinks(id) {
  const [map, nodes, links] = await Promise.all([
    getNetworkTopologyMap(id),
    listNetworkTopologyNodes(id),
    listNetworkTopologyLinks(id)
  ]);
  return { map, nodes, links };
}

/**
 * Um mapa por segmento ou grupo, criado sob demanda na primeira visita -
 * reaproveita 100% do CRUD de no/link ja existente, so troca "criar mapa"
 * por "abrir o mapa deste segmento/grupo", que ja existe ou acaba de ser
 * criado com o nome real do segmento/grupo.
 */
export async function getMapByScope(scopeType, scopeId, user, scopeName) {
  if (!scopeId) {
    throw badRequest("Informe o id do escopo do mapa de rede.");
  }

  let defaultName;
  if (scopeType === "inventory_tab") {
    // Sem tabela/entidade pra validar (ver comentario acima de SCOPE_LOOKUPS) -
    // o nome da aba, ja conhecido pelo cliente, so e usado na primeira criacao.
    defaultName = String(scopeName || "").trim() || "Mapa da aba";
  } else {
    const lookup = SCOPE_LOOKUPS[scopeType];
    if (!lookup) {
      throw badRequest("Escopo do mapa de rede nao suportado.");
    }
    const scopeEntity = await lookup.find(scopeId);
    if (!scopeEntity) {
      throw notFoundError(lookup.notFoundMessage);
    }
    defaultName = scopeEntity.name;
  }

  const map = await getOrCreateNetworkTopologyMapByScope(scopeType, scopeId, defaultName, user);
  const [nodes, links] = await Promise.all([
    listNetworkTopologyNodes(map.id),
    listNetworkTopologyLinks(map.id)
  ]);
  return { map, nodes, links };
}

export async function createMap(payload, user) {
  const map = await createNetworkTopologyMap(payload, user);
  notifySnapshot("network topology map create");
  return map;
}

export async function updateMap(id, payload, user) {
  const map = await updateNetworkTopologyMap(id, payload, user);
  notifySnapshot("network topology map update");
  return map;
}

export async function removeMap(id, user) {
  const map = await deleteNetworkTopologyMap(id, user);
  notifySnapshot("network topology map delete");
  return map;
}

export async function addNode(mapId, payload, user) {
  await ensureNodeRefExists(payload?.nodeType ?? payload?.node_type, payload?.refId ?? payload?.ref_id);
  const node = await withDuplicateRemap(
    () => createNetworkTopologyNode(mapId, payload, user),
    "Este item ja esta posicionado neste mapa de rede."
  );
  notifySnapshot("network topology node create");
  return node;
}

export async function editNode(id, payload, user) {
  await ensureNodeRefExists(payload?.nodeType ?? payload?.node_type, payload?.refId ?? payload?.ref_id);
  const node = await withDuplicateRemap(
    () => updateNetworkTopologyNode(id, payload, user),
    "Este item ja esta posicionado neste mapa de rede."
  );
  notifySnapshot("network topology node update");
  return node;
}

export async function saveNodePositions(mapId, positions, user) {
  if (!Array.isArray(positions) || !positions.length) {
    throw badRequest("Informe ao menos uma posicao para salvar.");
  }
  const nodes = await bulkUpdateNetworkTopologyNodePositions(mapId, positions, user);
  notifySnapshot("network topology node positions save");
  return nodes;
}

export async function removeNode(id, user) {
  const node = await deleteNetworkTopologyNode(id, user);
  notifySnapshot("network topology node delete");
  return node;
}

export async function addLink(mapId, payload, user) {
  const sourceType = payload?.sourceType ?? payload?.source_type;
  await ensureNodeRefExists(sourceType, payload?.sourceAssetId ?? payload?.source_asset_id);
  await ensureNodeRefExists(payload?.targetType ?? payload?.target_type, payload?.targetAssetId ?? payload?.target_asset_id);
  const link = await withDuplicateRemap(
    () => createNetworkTopologyLink(mapId, payload, user),
    "Ja existe uma conexao entre estes dois itens neste mapa."
  );
  notifySnapshot("network topology link create");
  return link;
}

export async function editLink(id, payload, user) {
  await ensureNodeRefExists(payload?.sourceType ?? payload?.source_type, payload?.sourceAssetId ?? payload?.source_asset_id);
  await ensureNodeRefExists(payload?.targetType ?? payload?.target_type, payload?.targetAssetId ?? payload?.target_asset_id);
  const link = await withDuplicateRemap(
    () => updateNetworkTopologyLink(id, payload, user),
    "Ja existe uma conexao entre estes dois itens neste mapa."
  );
  notifySnapshot("network topology link update");
  return link;
}

export async function removeLink(id, user) {
  const link = await deleteNetworkTopologyLink(id, user);
  notifySnapshot("network topology link delete");
  return link;
}

/**
 * hints (opcional): [{ assetId, assetType }] - o cliente ja tem a lista completa e
 * decorada de devices (com tipo real, vindo de agente/manual/OCS/Zabbix); o backend
 * nao tenta resolver tipo de ativo cruzando tabelas, so recebe a dica de quais
 * assetIds contam como "centrais" (server/switch/router/nas).
 */
export async function generateAutoLayout(mapId, hints, user) {
  const [nodes, links] = await Promise.all([
    listNetworkTopologyNodes(mapId),
    listNetworkTopologyLinks(mapId)
  ]);

  const centralAssetIds = new Set(
    (Array.isArray(hints) ? hints : [])
      .filter((hint) => CENTRAL_ASSET_TYPES.has(hint?.assetType))
      .map((hint) => hint.assetId)
  );

  const positions = computeAutoLayout({ nodes, links, centralAssetIds });
  const saved = await bulkUpdateNetworkTopologyNodePositions(mapId, positions, user);
  notifySnapshot("network topology auto layout");
  return saved;
}
