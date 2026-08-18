import { badRequest, conflict } from "../lib/errors.js";
import {
  createNetworkTopologyLink,
  createNetworkTopologyMap,
  createNetworkTopologyNode,
  deleteNetworkTopologyLink,
  deleteNetworkTopologyMap,
  deleteNetworkTopologyNode,
  bulkUpdateNetworkTopologyNodePositions,
  getNetworkTopologyMap,
  listNetworkTopologyLinks,
  listNetworkTopologyMaps,
  listNetworkTopologyNodes,
  updateNetworkTopologyLink,
  updateNetworkTopologyMap,
  updateNetworkTopologyNode
} from "../repositories/networkTopologyRepository.js";
import { computeAutoLayout } from "./networkTopologyAutoLayout.js";
import { broadcastSnapshot } from "./realtimeService.js";

const CENTRAL_ASSET_TYPES = new Set(["server", "switch", "router", "nas"]);

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
  const node = await withDuplicateRemap(
    () => createNetworkTopologyNode(mapId, payload, user),
    "Este ativo ja esta posicionado neste mapa de rede."
  );
  notifySnapshot("network topology node create");
  return node;
}

export async function editNode(id, payload, user) {
  const node = await withDuplicateRemap(
    () => updateNetworkTopologyNode(id, payload, user),
    "Este ativo ja esta posicionado neste mapa de rede."
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
  const link = await withDuplicateRemap(
    () => createNetworkTopologyLink(mapId, payload, user),
    "Ja existe uma conexao entre estes dois ativos neste mapa."
  );
  notifySnapshot("network topology link create");
  return link;
}

export async function editLink(id, payload, user) {
  const link = await withDuplicateRemap(
    () => updateNetworkTopologyLink(id, payload, user),
    "Ja existe uma conexao entre estes dois ativos neste mapa."
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
