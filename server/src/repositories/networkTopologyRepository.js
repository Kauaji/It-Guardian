import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addLog } from "./logRepository.js";
import { addAssetHistory } from "./assetHistoryRepository.js";

export const TOPOLOGY_MAP_SCOPE_TYPES = new Set(["global", "inventory_tab", "group", "segment"]);
export const TOPOLOGY_NODE_TYPES = new Set(["asset", "segment", "group"]);
export const TOPOLOGY_LINK_TYPES = new Set(["ethernet", "wifi", "fiber", "logical", "unknown"]);
export const TOPOLOGY_LINK_STATUS_OVERRIDES = new Set([
  "online",
  "warning",
  "critical",
  "offline",
  "unknown",
  "manual"
]);

function makeHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeMapPayload(payload = {}, existing = {}) {
  const name = normalizeText(payload.name, existing.name || "");
  if (name.length < 2) {
    throw makeHttpError("Informe um nome para o mapa de rede.");
  }

  const scopeType = normalizeText(payload.scopeType ?? payload.scope_type ?? existing.scopeType, "global");
  if (!TOPOLOGY_MAP_SCOPE_TYPES.has(scopeType)) {
    throw makeHttpError("Escopo do mapa de rede nao suportado.");
  }

  return {
    name,
    scopeType,
    scopeId: nullableText(payload.scopeId ?? payload.scope_id ?? existing.scopeId)
  };
}

export function normalizeNodePayload(payload = {}, existing = {}) {
  const nodeType = normalizeText(payload.nodeType ?? payload.node_type ?? existing.nodeType, "asset");
  if (!TOPOLOGY_NODE_TYPES.has(nodeType)) {
    throw makeHttpError("Tipo de no do mapa de rede nao suportado.");
  }

  const shared = {
    x: finiteNumber(payload.x, existing.x ?? 0),
    y: finiteNumber(payload.y, existing.y ?? 0),
    pinned: Boolean(payload.pinned ?? existing.pinned ?? false),
    labelOverride: nullableText(payload.labelOverride ?? payload.label_override ?? existing.labelOverride)
  };

  if (nodeType === "asset") {
    const assetId = nullableText(payload.assetId ?? payload.asset_id ?? existing.assetId);
    if (!assetId) {
      throw makeHttpError("Informe o ativo a ser posicionado no mapa de rede.");
    }
    return { nodeType, assetId, refId: null, ...shared };
  }

  const refId = nullableText(payload.refId ?? payload.ref_id ?? existing.refId);
  if (!refId) {
    throw makeHttpError("Informe o segmento ou grupo a ser posicionado no mapa de rede.");
  }
  return { nodeType, assetId: null, refId, ...shared };
}

export function normalizeLinkPayload(payload = {}, existing = {}) {
  const sourceType = normalizeText(payload.sourceType ?? payload.source_type ?? existing.sourceType, "asset");
  const targetType = normalizeText(payload.targetType ?? payload.target_type ?? existing.targetType, "asset");
  if (!TOPOLOGY_NODE_TYPES.has(sourceType) || !TOPOLOGY_NODE_TYPES.has(targetType)) {
    throw makeHttpError("Tipo de no da conexao nao suportado.");
  }
  if (sourceType !== targetType) {
    throw makeHttpError("Uma conexao so pode ligar dois nos do mesmo tipo.");
  }

  const sourceAssetId = nullableText(payload.sourceAssetId ?? payload.source_asset_id ?? existing.sourceAssetId);
  const targetAssetId = nullableText(payload.targetAssetId ?? payload.target_asset_id ?? existing.targetAssetId);
  if (!sourceAssetId || !targetAssetId) {
    throw makeHttpError("Informe os dois lados da conexao.");
  }
  if (sourceAssetId === targetAssetId) {
    throw makeHttpError("Um item nao pode se conectar com ele mesmo.");
  }

  const type = normalizeText(payload.type ?? existing.type, "unknown");
  if (!TOPOLOGY_LINK_TYPES.has(type)) {
    throw makeHttpError("Tipo de conexao nao suportado.");
  }

  const statusOverride = nullableText(payload.statusOverride ?? payload.status_override ?? existing.statusOverride);
  if (statusOverride && !TOPOLOGY_LINK_STATUS_OVERRIDES.has(statusOverride)) {
    throw makeHttpError("Status de conexao nao suportado.");
  }

  return {
    sourceType,
    targetType,
    sourceAssetId,
    targetAssetId,
    label: nullableText(payload.label ?? existing.label),
    type,
    statusOverride,
    description: nullableText(payload.description ?? existing.description)
  };
}

function mapFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function nodeFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    nodeType: row.node_type,
    assetId: row.asset_id,
    refId: row.ref_id,
    x: Number(row.x),
    y: Number(row.y),
    pinned: Boolean(row.pinned),
    labelOverride: row.label_override,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function linkFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    sourceType: row.source_type,
    targetType: row.target_type,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    label: row.label,
    type: row.type,
    statusOverride: row.status_override,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getMapOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_maps WHERE id = $1", [id]);
  const map = mapFromRow(result.rows[0]);
  if (!map) throw makeHttpError("Mapa de rede nao encontrado.", 404);
  return map;
}

async function getNodeOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_nodes WHERE id = $1", [id]);
  const node = nodeFromRow(result.rows[0]);
  if (!node) throw makeHttpError("Ativo nao encontrado neste mapa de rede.", 404);
  return node;
}

async function getLinkOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_links WHERE id = $1", [id]);
  const link = linkFromRow(result.rows[0]);
  if (!link) throw makeHttpError("Conexao nao encontrada neste mapa de rede.", 404);
  return link;
}

// Ativos vem de fontes diferentes (agente, manual, OCS/Zabbix) sem uma tabela unica -
// checagem de existencia deliberadamente sem FK, para que remover um ativo nunca quebre
// (CASCADE) um no/conexao ja salvos no mapa.
async function ensureAssetsExist(assetIds, db = query) {
  const ids = [...new Set(assetIds.filter(Boolean))];
  for (const assetId of ids) {
    const result = await db(
      `
        SELECT $1 AS id
        WHERE EXISTS (SELECT 1 FROM manual_network_assets WHERE id = $1)
           OR EXISTS (SELECT 1 FROM device_metadata WHERE device_id = $1 AND removed_at IS NULL)
           OR EXISTS (SELECT 1 FROM device_segments WHERE device_id = $1)
      `,
      [assetId]
    );

    if (!result.rows.length) {
      throw makeHttpError("Ativo informado nao foi encontrado.");
    }
  }
}

// Funciona pra ativo ou cluster porque a CHECK de consistencia da tabela
// garante que so um de ref_id/asset_id esta preenchido por linha - o outro
// e sempre NULL, entao COALESCE devolve exatamente o valor que importa.
async function ensureNodeRefAvailable(mapId, nodeType, refValue, excludeNodeId = null, db = query) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_nodes
      WHERE map_id = $1
        AND node_type = $2
        AND COALESCE(ref_id, asset_id) = $3
        AND ($4::text IS NULL OR id <> $4)
      LIMIT 1
    `,
    [mapId, nodeType, refValue, excludeNodeId]
  );

  if (result.rows.length) {
    throw makeHttpError(
      nodeType === "asset" ? "Este ativo ja esta posicionado neste mapa de rede." : "Este item ja esta posicionado neste mapa de rede.",
      409
    );
  }
}

async function ensureLinkNotDuplicate(mapId, sourceType, targetType, sourceAssetId, targetAssetId, excludeLinkId = null, db = query) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_links
      WHERE map_id = $1
        AND ($6::text IS NULL OR id <> $6)
        AND (
          (source_type = $2 AND target_type = $3 AND source_asset_id = $4 AND target_asset_id = $5)
          OR (source_type = $3 AND target_type = $2 AND source_asset_id = $5 AND target_asset_id = $4)
        )
      LIMIT 1
    `,
    [mapId, sourceType, targetType, sourceAssetId, targetAssetId, excludeLinkId]
  );

  if (result.rows.length) {
    throw makeHttpError("Ja existe uma conexao entre estes dois itens neste mapa.", 409);
  }
}

export async function listNetworkTopologyMaps() {
  const result = await query(`
    SELECT *
    FROM network_topology_maps
    ORDER BY updated_at DESC, created_at DESC
  `);
  return result.rows.map(mapFromRow);
}

export async function getNetworkTopologyMap(id) {
  return getMapOrThrow(id);
}

export async function createNetworkTopologyMap(payload, user) {
  const data = normalizeMapPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const result = await db(
      `
        INSERT INTO network_topology_maps (id, name, scope_type, scope_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [id, data.name, data.scopeType, data.scopeId, user?.id || null]
    );

    await addLog({
      type: "inventory.network_topology.map.created",
      message: `Mapa de rede criado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return mapFromRow(result.rows[0]);
  });
}

export async function updateNetworkTopologyMap(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    const data = normalizeMapPayload(payload, existing);
    const result = await db(
      `
        UPDATE network_topology_maps
        SET name = $2, scope_type = $3, scope_id = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, data.name, data.scopeType, data.scopeId]
    );

    await addLog({
      type: "inventory.network_topology.map.updated",
      message: `Mapa de rede atualizado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return mapFromRow(result.rows[0]);
  });
}

export async function deleteNetworkTopologyMap(id, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    await db("DELETE FROM network_topology_maps WHERE id = $1", [id]);
    await addLog({
      type: "inventory.network_topology.map.deleted",
      message: `Mapa de rede removido: ${existing.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });
    return existing;
  });
}

// Get-or-create: um mapa por segmento/grupo, criado na primeira vez que o
// tecnico abre aquele nivel na hierarquia, em vez de exigir um passo
// separado de "criar mapa" como o fluxo global de hoje.
export async function getOrCreateNetworkTopologyMapByScope(scopeType, scopeId, defaultName, user) {
  return withTransaction(async (db) => {
    const existing = await db(
      "SELECT * FROM network_topology_maps WHERE scope_type = $1 AND scope_id = $2 LIMIT 1",
      [scopeType, scopeId]
    );
    if (existing.rows[0]) {
      return mapFromRow(existing.rows[0]);
    }

    const id = randomUUID();
    const result = await db(
      `
        INSERT INTO network_topology_maps (id, name, scope_type, scope_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [id, defaultName, scopeType, scopeId, user?.id || null]
    );

    await addLog({
      type: "inventory.network_topology.map.created",
      message: `Mapa de rede criado automaticamente: ${defaultName}.`,
      userId: user?.id,
      meta: { mapId: id, scopeType, scopeId },
      db
    });

    return mapFromRow(result.rows[0]);
  });
}

export async function listNetworkTopologyNodes(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    "SELECT * FROM network_topology_nodes WHERE map_id = $1 ORDER BY created_at ASC",
    [mapId]
  );
  return result.rows.map(nodeFromRow);
}

export async function listNetworkTopologyLinks(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    "SELECT * FROM network_topology_links WHERE map_id = $1 ORDER BY created_at ASC",
    [mapId]
  );
  return result.rows.map(linkFromRow);
}

// Snapshot atual (nao historico) de onde um ativo aparece no Mapa de Rede -
// cobre vinculos criados antes desta consulta existir, que nao tem evento
// em asset_history.
export async function findNetworkTopologyReferencesForAsset(assetId) {
  const nodesResult = await query(
    `
      SELECT n.id AS node_id, n.map_id, m.name AS map_name
      FROM network_topology_nodes n
      JOIN network_topology_maps m ON m.id = n.map_id
      WHERE n.asset_id = $1
    `,
    [assetId]
  );

  const linksResult = await query(
    `
      SELECT l.id AS link_id, l.map_id, m.name AS map_name,
             l.source_asset_id, l.target_asset_id, l.label, l.type
      FROM network_topology_links l
      JOIN network_topology_maps m ON m.id = l.map_id
      WHERE l.source_asset_id = $1 OR l.target_asset_id = $1
    `,
    [assetId]
  );

  const mapIds = new Set();
  for (const row of nodesResult.rows) mapIds.add(row.map_id);
  for (const row of linksResult.rows) mapIds.add(row.map_id);

  return {
    mapCount: mapIds.size,
    maps: Array.from(mapIds).map((mapId) => {
      const mapName =
        nodesResult.rows.find((row) => row.map_id === mapId)?.map_name ||
        linksResult.rows.find((row) => row.map_id === mapId)?.map_name ||
        "";
      return { mapId, mapName };
    }),
    links: linksResult.rows.map((row) => ({
      linkId: row.link_id,
      mapId: row.map_id,
      mapName: row.map_name,
      otherAssetId: row.source_asset_id === assetId ? row.target_asset_id : row.source_asset_id,
      label: row.label,
      type: row.type
    }))
  };
}

export async function createNetworkTopologyNode(mapId, payload, user) {
  const data = normalizeNodePayload(payload);
  const id = randomUUID();
  const refValue = data.assetId ?? data.refId;

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    if (data.nodeType === "asset") {
      await ensureAssetsExist([data.assetId], db);
    }
    await ensureNodeRefAvailable(mapId, data.nodeType, refValue, null, db);

    const result = await db(
      `
        INSERT INTO network_topology_nodes (id, map_id, node_type, asset_id, ref_id, x, y, pinned, label_override)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [id, mapId, data.nodeType, data.assetId, data.refId, data.x, data.y, data.pinned, data.labelOverride]
    );

    await addLog({
      type: "inventory.network_topology.node.created",
      message: data.nodeType === "asset" ? `Ativo adicionado ao mapa de rede.` : `Item adicionado ao mapa de rede.`,
      userId: user?.id,
      meta: { mapId, nodeId: id, nodeType: data.nodeType, assetId: data.assetId, refId: data.refId },
      db
    });
    if (data.assetId) {
      await addAssetHistory({
        assetId: data.assetId,
        eventType: "network_topology_node_added",
        message: "Ativo adicionado a um mapa de rede.",
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    return nodeFromRow(result.rows[0]);
  });
}

export async function updateNetworkTopologyNode(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getNodeOrThrow(id, db);
    const data = normalizeNodePayload(payload, existing);
    const refValue = data.assetId ?? data.refId;
    const existingRefValue = existing.assetId ?? existing.refId;
    if (data.nodeType !== existing.nodeType || refValue !== existingRefValue) {
      if (data.nodeType === "asset") {
        await ensureAssetsExist([data.assetId], db);
      }
      await ensureNodeRefAvailable(existing.mapId, data.nodeType, refValue, id, db);
    }

    const result = await db(
      `
        UPDATE network_topology_nodes
        SET node_type = $2, asset_id = $3, ref_id = $4, x = $5, y = $6, pinned = $7, label_override = $8, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, data.nodeType, data.assetId, data.refId, data.x, data.y, data.pinned, data.labelOverride]
    );

    await addLog({
      type: "inventory.network_topology.node.updated",
      message: data.nodeType === "asset" ? `Ativo atualizado no mapa de rede.` : `Item atualizado no mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, nodeType: data.nodeType, assetId: data.assetId, refId: data.refId },
      db
    });

    return nodeFromRow(result.rows[0]);
  });
}

// Salva em lote as posicoes arrastadas no canvas (botao "Salvar layout") - um unico
// PATCH em vez de um PATCH por no movido.
export async function bulkUpdateNetworkTopologyNodePositions(mapId, positions, user) {
  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    const updated = [];

    for (const entry of positions) {
      const nodeId = nullableText(entry.nodeId ?? entry.id);
      if (!nodeId) continue;
      const existing = await getNodeOrThrow(nodeId, db);
      if (existing.mapId !== mapId) {
        throw makeHttpError("No informado pertence a outro mapa de rede.");
      }

      const x = finiteNumber(entry.x, existing.x);
      const y = finiteNumber(entry.y, existing.y);
      const result = await db(
        "UPDATE network_topology_nodes SET x = $2, y = $3, updated_at = NOW() WHERE id = $1 RETURNING *",
        [nodeId, x, y]
      );
      updated.push(nodeFromRow(result.rows[0]));
    }

    if (updated.length) {
      await addLog({
        type: "inventory.network_topology.node.positions_saved",
        message: `Layout do mapa de rede salvo (${updated.length} ativo(s)).`,
        userId: user?.id,
        meta: { mapId, nodeIds: updated.map((node) => node.id) },
        db
      });
    }

    return updated;
  });
}

export async function deleteNetworkTopologyNode(id, user) {
  return withTransaction(async (db) => {
    const existing = await getNodeOrThrow(id, db);
    await db("DELETE FROM network_topology_nodes WHERE id = $1", [id]);
    await addLog({
      type: "inventory.network_topology.node.deleted",
      message: existing.assetId ? `Ativo removido do mapa de rede.` : `Item removido do mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, nodeType: existing.nodeType, assetId: existing.assetId, refId: existing.refId },
      db
    });
    if (existing.assetId) {
      await addAssetHistory({
        assetId: existing.assetId,
        eventType: "network_topology_node_removed",
        message: "Ativo removido de um mapa de rede.",
        userId: user?.id,
        userName: user?.name,
        db
      });
    }
    return existing;
  });
}

export async function createNetworkTopologyLink(mapId, payload, user) {
  const data = normalizeLinkPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    if (data.sourceType === "asset") {
      await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
    }
    await ensureLinkNotDuplicate(mapId, data.sourceType, data.targetType, data.sourceAssetId, data.targetAssetId, null, db);

    const result = await db(
      `
        INSERT INTO network_topology_links (
          id, map_id, source_type, target_type, source_asset_id, target_asset_id, label, type, status_override, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        id,
        mapId,
        data.sourceType,
        data.targetType,
        data.sourceAssetId,
        data.targetAssetId,
        data.label,
        data.type,
        data.statusOverride,
        data.description
      ]
    );

    await addLog({
      type: "inventory.network_topology.link.created",
      message: `Conexao criada no mapa de rede.`,
      userId: user?.id,
      meta: { mapId, linkId: id, sourceType: data.sourceType, sourceAssetId: data.sourceAssetId, targetAssetId: data.targetAssetId },
      db
    });
    if (data.sourceType === "asset") {
      for (const assetId of [data.sourceAssetId, data.targetAssetId]) {
        await addAssetHistory({
          assetId,
          eventType: "network_topology_link_created",
          message: "Conexao criada no mapa de rede envolvendo este ativo.",
          userId: user?.id,
          userName: user?.name,
          db
        });
      }
    }

    return linkFromRow(result.rows[0]);
  });
}

export async function updateNetworkTopologyLink(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getLinkOrThrow(id, db);
    const data = normalizeLinkPayload(payload, existing);
    if (
      data.sourceType !== existing.sourceType ||
      data.sourceAssetId !== existing.sourceAssetId ||
      data.targetAssetId !== existing.targetAssetId
    ) {
      if (data.sourceType === "asset") {
        await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
      }
      await ensureLinkNotDuplicate(existing.mapId, data.sourceType, data.targetType, data.sourceAssetId, data.targetAssetId, id, db);
    }

    const result = await db(
      `
        UPDATE network_topology_links
        SET source_type = $2, target_type = $3, source_asset_id = $4, target_asset_id = $5, label = $6, type = $7,
            status_override = $8, description = $9, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        data.sourceType,
        data.targetType,
        data.sourceAssetId,
        data.targetAssetId,
        data.label,
        data.type,
        data.statusOverride,
        data.description
      ]
    );

    await addLog({
      type: "inventory.network_topology.link.updated",
      message: `Conexao atualizada no mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, linkId: id },
      db
    });

    return linkFromRow(result.rows[0]);
  });
}

export async function deleteNetworkTopologyLink(id, user) {
  return withTransaction(async (db) => {
    const existing = await getLinkOrThrow(id, db);
    await db("DELETE FROM network_topology_links WHERE id = $1", [id]);
    await addLog({
      type: "inventory.network_topology.link.deleted",
      message: `Conexao removida do mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, linkId: id },
      db
    });
    if (existing.sourceType === "asset") {
      for (const assetId of [existing.sourceAssetId, existing.targetAssetId]) {
        await addAssetHistory({
          assetId,
          eventType: "network_topology_link_removed",
          message: "Conexao removida do mapa de rede envolvendo este ativo.",
          userId: user?.id,
          userName: user?.name,
          db
        });
      }
    }
    return existing;
  });
}
