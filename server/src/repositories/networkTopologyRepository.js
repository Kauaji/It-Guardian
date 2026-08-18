import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addLog } from "./logRepository.js";

export const TOPOLOGY_MAP_SCOPE_TYPES = new Set(["global", "inventory_tab", "group", "segment"]);
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
  const assetId = nullableText(payload.assetId ?? payload.asset_id ?? existing.assetId);
  if (!assetId) {
    throw makeHttpError("Informe o ativo a ser posicionado no mapa de rede.");
  }

  return {
    assetId,
    x: finiteNumber(payload.x, existing.x ?? 0),
    y: finiteNumber(payload.y, existing.y ?? 0),
    pinned: Boolean(payload.pinned ?? existing.pinned ?? false),
    labelOverride: nullableText(payload.labelOverride ?? payload.label_override ?? existing.labelOverride)
  };
}

export function normalizeLinkPayload(payload = {}, existing = {}) {
  const sourceAssetId = nullableText(payload.sourceAssetId ?? payload.source_asset_id ?? existing.sourceAssetId);
  const targetAssetId = nullableText(payload.targetAssetId ?? payload.target_asset_id ?? existing.targetAssetId);
  if (!sourceAssetId || !targetAssetId) {
    throw makeHttpError("Informe os dois ativos da conexao.");
  }
  if (sourceAssetId === targetAssetId) {
    throw makeHttpError("Um ativo nao pode se conectar com ele mesmo.");
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
    assetId: row.asset_id,
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

async function ensureNodeAssetAvailable(mapId, assetId, excludeNodeId = null, db = query) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_nodes
      WHERE map_id = $1
        AND asset_id = $2
        AND ($3::text IS NULL OR id <> $3)
      LIMIT 1
    `,
    [mapId, assetId, excludeNodeId]
  );

  if (result.rows.length) {
    throw makeHttpError("Este ativo ja esta posicionado neste mapa de rede.", 409);
  }
}

async function ensureLinkNotDuplicate(mapId, sourceAssetId, targetAssetId, excludeLinkId = null, db = query) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_links
      WHERE map_id = $1
        AND ($3::text IS NULL OR id <> $3)
        AND (
          (source_asset_id = $2 AND target_asset_id = $4)
          OR (source_asset_id = $4 AND target_asset_id = $2)
        )
      LIMIT 1
    `,
    [mapId, sourceAssetId, excludeLinkId, targetAssetId]
  );

  if (result.rows.length) {
    throw makeHttpError("Ja existe uma conexao entre estes dois ativos neste mapa.", 409);
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

export async function createNetworkTopologyNode(mapId, payload, user) {
  const data = normalizeNodePayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    await ensureAssetsExist([data.assetId], db);
    await ensureNodeAssetAvailable(mapId, data.assetId, null, db);

    const result = await db(
      `
        INSERT INTO network_topology_nodes (id, map_id, asset_id, x, y, pinned, label_override)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [id, mapId, data.assetId, data.x, data.y, data.pinned, data.labelOverride]
    );

    await addLog({
      type: "inventory.network_topology.node.created",
      message: `Ativo adicionado ao mapa de rede.`,
      userId: user?.id,
      meta: { mapId, nodeId: id, assetId: data.assetId },
      db
    });

    return nodeFromRow(result.rows[0]);
  });
}

export async function updateNetworkTopologyNode(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getNodeOrThrow(id, db);
    const data = normalizeNodePayload(payload, existing);
    if (data.assetId !== existing.assetId) {
      await ensureAssetsExist([data.assetId], db);
      await ensureNodeAssetAvailable(existing.mapId, data.assetId, id, db);
    }

    const result = await db(
      `
        UPDATE network_topology_nodes
        SET asset_id = $2, x = $3, y = $4, pinned = $5, label_override = $6, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, data.assetId, data.x, data.y, data.pinned, data.labelOverride]
    );

    await addLog({
      type: "inventory.network_topology.node.updated",
      message: `Ativo atualizado no mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, assetId: data.assetId },
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
      message: `Ativo removido do mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, assetId: existing.assetId },
      db
    });
    return existing;
  });
}

export async function createNetworkTopologyLink(mapId, payload, user) {
  const data = normalizeLinkPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
    await ensureLinkNotDuplicate(mapId, data.sourceAssetId, data.targetAssetId, null, db);

    const result = await db(
      `
        INSERT INTO network_topology_links (
          id, map_id, source_asset_id, target_asset_id, label, type, status_override, description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [id, mapId, data.sourceAssetId, data.targetAssetId, data.label, data.type, data.statusOverride, data.description]
    );

    await addLog({
      type: "inventory.network_topology.link.created",
      message: `Conexao criada no mapa de rede.`,
      userId: user?.id,
      meta: { mapId, linkId: id, sourceAssetId: data.sourceAssetId, targetAssetId: data.targetAssetId },
      db
    });

    return linkFromRow(result.rows[0]);
  });
}

export async function updateNetworkTopologyLink(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getLinkOrThrow(id, db);
    const data = normalizeLinkPayload(payload, existing);
    if (data.sourceAssetId !== existing.sourceAssetId || data.targetAssetId !== existing.targetAssetId) {
      await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
      await ensureLinkNotDuplicate(existing.mapId, data.sourceAssetId, data.targetAssetId, id, db);
    }

    const result = await db(
      `
        UPDATE network_topology_links
        SET source_asset_id = $2, target_asset_id = $3, label = $4, type = $5,
            status_override = $6, description = $7, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, data.sourceAssetId, data.targetAssetId, data.label, data.type, data.statusOverride, data.description]
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
    return existing;
  });
}
