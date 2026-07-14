import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";

export const STRUCTURE_PRESETS = new Set(["wall", "partition", "room", "corridor", "desk", "rack"]);

export const VISUAL_MAP_LAYERS = new Set(["structure", "assets", "infrastructure", "electrical"]);
export const CONNECTION_LAYERS = new Set(["infrastructure", "electrical"]);

export const ASSET_PRESETS = new Set([
  "desktop",
  "notebook",
  "server",
  "switch",
  "router",
  "access_point",
  "printer",
  "ups",
  "network_point",
  "power_point"
]);

export const INFRASTRUCTURE_PRESETS = new Set([
  "network_point",
  "network_cable",
  "backbone",
  "technical_rack",
  "switch",
  "router",
  "access_point",
  "patch_panel",
  "ip_camera"
]);

export const ELECTRICAL_PRESETS = new Set([
  "power_point",
  "outlet",
  "power_line",
  "circuit",
  "electrical_panel",
  "ups"
]);

export const INFRASTRUCTURE_CONNECTION_TYPES = new Set([
  "network_cable",
  "backbone",
  "uplink",
  "rack_link",
  "ap_coverage_link"
]);

export const ELECTRICAL_CONNECTION_TYPES = new Set([
  "power_line",
  "circuit_line",
  "ups_line"
]);

const DEFAULT_STRUCTURE_DIMENSIONS = {
  wall: { width: 4, depth: 0.18, height: 2.4, color: "#64748b", label: "Parede" },
  partition: { width: 3, depth: 0.12, height: 1.6, color: "#94a3b8", label: "Divisoria" },
  room: { width: 5, depth: 4, height: 0.15, color: "#cbd5e1", label: "Sala" },
  corridor: { width: 6, depth: 2, height: 0.08, color: "#dbeafe", label: "Corredor" },
  desk: { width: 1.8, depth: 0.85, height: 0.75, color: "#b45309", label: "Mesa" },
  rack: { width: 0.85, depth: 1, height: 2, color: "#334155", label: "Rack" }
};

const DEFAULT_ASSET_DIMENSIONS = {
  desktop: { width: 0.9, depth: 0.65, height: 0.35, color: "#2563eb", label: "Desktop" },
  notebook: { width: 0.8, depth: 0.55, height: 0.18, color: "#7c3aed", label: "Notebook" },
  server: { width: 0.95, depth: 0.95, height: 1.25, color: "#0f766e", label: "Servidor" },
  switch: { width: 0.75, depth: 0.45, height: 0.18, color: "#1d4ed8", label: "Switch" },
  router: { width: 0.65, depth: 0.45, height: 0.22, color: "#0284c7", label: "Roteador" },
  access_point: { width: 0.45, depth: 0.45, height: 0.12, color: "#0891b2", label: "Access point" },
  printer: { width: 0.85, depth: 0.75, height: 0.45, color: "#ca8a04", label: "Impressora" },
  ups: { width: 0.55, depth: 0.6, height: 0.55, color: "#9333ea", label: "Nobreak" },
  network_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#16a34a", label: "Ponto de rede" },
  power_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#dc2626", label: "Ponto eletrico" }
};

const DEFAULT_INFRASTRUCTURE_DIMENSIONS = {
  network_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#16a34a", label: "Ponto de rede" },
  network_cable: { width: 2.2, depth: 0.08, height: 0.08, color: "#0ea5e9", label: "Cabo de rede" },
  backbone: { width: 3.2, depth: 0.1, height: 0.1, color: "#0284c7", label: "Backbone" },
  technical_rack: { width: 0.9, depth: 1, height: 2.1, color: "#334155", label: "Rack tecnico" },
  switch: { width: 0.75, depth: 0.45, height: 0.18, color: "#1d4ed8", label: "Switch" },
  router: { width: 0.65, depth: 0.45, height: 0.22, color: "#0284c7", label: "Roteador" },
  access_point: { width: 0.45, depth: 0.45, height: 0.12, color: "#0891b2", label: "Access point" },
  patch_panel: { width: 0.8, depth: 0.35, height: 0.16, color: "#0369a1", label: "Patch panel" },
  ip_camera: { width: 0.35, depth: 0.35, height: 0.25, color: "#475569", label: "Camera IP" }
};

const DEFAULT_ELECTRICAL_DIMENSIONS = {
  power_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#dc2626", label: "Ponto eletrico" },
  outlet: { width: 0.28, depth: 0.12, height: 0.22, color: "#f97316", label: "Tomada" },
  power_line: { width: 2.2, depth: 0.08, height: 0.08, color: "#f59e0b", label: "Linha eletrica" },
  circuit: { width: 1.4, depth: 0.16, height: 0.14, color: "#eab308", label: "Circuito" },
  electrical_panel: { width: 0.75, depth: 0.22, height: 1.1, color: "#b45309", label: "Quadro eletrico" },
  ups: { width: 0.55, depth: 0.6, height: 0.55, color: "#9333ea", label: "Nobreak" }
};

const ALL_PRESETS = new Set([
  ...STRUCTURE_PRESETS,
  ...ASSET_PRESETS,
  ...INFRASTRUCTURE_PRESETS,
  ...ELECTRICAL_PRESETS
]);

const CONNECTION_TYPES_BY_LAYER = {
  infrastructure: INFRASTRUCTURE_CONNECTION_TYPES,
  electrical: ELECTRICAL_CONNECTION_TYPES
};

const DEFAULT_CONNECTION_BY_LAYER = {
  infrastructure: "network_cable",
  electrical: "power_line"
};

const DEFAULT_CONNECTION_COLOR_BY_LAYER = {
  infrastructure: "#0ea5e9",
  electrical: "#f97316"
};

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

function numberInRange(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function parseMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function parseJsonField(value) {
  if (!value) return {};
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
}

export function resolveObjectLayer(presetType, explicitLayer) {
  if (VISUAL_MAP_LAYERS.has(explicitLayer)) return explicitLayer;
  if (STRUCTURE_PRESETS.has(presetType)) return "structure";
  if (INFRASTRUCTURE_PRESETS.has(presetType)) return "infrastructure";
  if (ELECTRICAL_PRESETS.has(presetType)) return "electrical";
  return "assets";
}

function defaultsForPreset(presetType, layer) {
  if (layer === "structure") return DEFAULT_STRUCTURE_DIMENSIONS[presetType];
  if (layer === "infrastructure") return DEFAULT_INFRASTRUCTURE_DIMENSIONS[presetType];
  if (layer === "electrical") return DEFAULT_ELECTRICAL_DIMENSIONS[presetType];
  return DEFAULT_ASSET_DIMENSIONS[presetType];
}

function normalizePoint(point) {
  const source = Array.isArray(point)
    ? { x: point[0], y: point[1], z: point[2] }
    : point || {};

  return {
    x: numberInRange(source.x ?? source.positionX, 0, -200, 200),
    y: numberInRange(source.y ?? source.positionY, 0.08, -50, 50),
    z: numberInRange(source.z ?? source.positionZ, 0, -200, 200)
  };
}

function parsePoints(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
}

export function resolveConnectionTypeLayer(connectionType) {
  if (INFRASTRUCTURE_CONNECTION_TYPES.has(connectionType)) return "infrastructure";
  if (ELECTRICAL_CONNECTION_TYPES.has(connectionType)) return "electrical";
  return null;
}

export function normalizeMapPayload(payload = {}, existing = {}) {
  const name = normalizeText(payload.name, existing.name || "");
  if (name.length < 2) {
    throw makeHttpError("Informe um nome para o mapa visual.");
  }

  return {
    name,
    environmentId: nullableText(payload.environmentId ?? payload.environment_id ?? existing.environmentId),
    groupId: nullableText(payload.groupId ?? payload.group_id ?? existing.groupId),
    segmentId: nullableText(payload.segmentId ?? payload.segment_id ?? existing.segmentId),
    floorLabel: nullableText(payload.floorLabel ?? payload.floor_label ?? existing.floorLabel),
    width: numberInRange(payload.width ?? existing.width, 30, 5, 200),
    depth: numberInRange(payload.depth ?? existing.depth, 20, 5, 200),
    scale: numberInRange(payload.scale ?? existing.scale, 1, 0.1, 10),
    notes: nullableText(payload.notes ?? existing.notes)
  };
}

export function normalizeObjectPayload(payload = {}, existing = {}) {
  const presetType = normalizeText(payload.presetType ?? payload.preset_type ?? payload.objectType ?? existing.presetType, "desktop");
  if (!ALL_PRESETS.has(presetType)) {
    throw makeHttpError("Tipo de objeto do mapa visual nao suportado.");
  }

  const layer = resolveObjectLayer(presetType, payload.layer ?? existing.layer);
  const defaults = defaultsForPreset(presetType, layer);
  if (!defaults) {
    throw makeHttpError("Tipo de objeto incompatível com a camada informada.");
  }
  const colorValue = normalizeText(payload.color ?? existing.color, defaults.color);

  return {
    layer,
    presetType,
    label: normalizeText(payload.label ?? existing.label, defaults.label),
    linkedAssetId: nullableText(payload.linkedAssetId ?? payload.linked_asset_id ?? existing.linkedAssetId),
    positionX: numberInRange(payload.positionX ?? payload.x ?? payload.position_x ?? existing.positionX, 0, -200, 200),
    positionY: numberInRange(payload.positionY ?? payload.y ?? payload.position_y ?? existing.positionY, 0, -50, 50),
    positionZ: numberInRange(payload.positionZ ?? payload.z ?? payload.position_z ?? existing.positionZ, 0, -200, 200),
    rotationX: numberInRange(payload.rotationX ?? payload.rotation_x ?? existing.rotationX, 0, -360, 360),
    rotationY: numberInRange(payload.rotationY ?? payload.rotation_y ?? existing.rotationY, 0, -360, 360),
    rotationZ: numberInRange(payload.rotationZ ?? payload.rotation_z ?? existing.rotationZ, 0, -360, 360),
    width: numberInRange(payload.width ?? existing.width, defaults.width, 0.1, 50),
    depth: numberInRange(payload.depth ?? existing.depth, defaults.depth, 0.1, 50),
    height: numberInRange(payload.height ?? existing.height, defaults.height, 0.05, 20),
    color: isHexColor(colorValue) ? colorValue : defaults.color,
    notes: nullableText(payload.notes ?? existing.notes),
    metadata: parseMetadata(payload.metadata ?? payload.metadataJson ?? payload.metadata_json ?? existing.metadata)
  };
}

export function normalizeConnectionPayload(payload = {}, existing = {}) {
  const layer = normalizeText(payload.layer ?? existing.layer, "infrastructure");
  if (!CONNECTION_LAYERS.has(layer)) {
    throw makeHttpError("Camada de conexao do mapa visual nao suportada.");
  }

  const connectionType = normalizeText(
    payload.connectionType ?? payload.connection_type ?? existing.connectionType,
    DEFAULT_CONNECTION_BY_LAYER[layer]
  );

  if (!CONNECTION_TYPES_BY_LAYER[layer].has(connectionType)) {
    throw makeHttpError("Tipo de conexao incompatível com a camada informada.");
  }

  const rawPoints = parsePoints(payload.points ?? payload.pointsJson ?? payload.points_json ?? existing.points);
  const points = rawPoints.map(normalizePoint);
  if (points.length < 2) {
    throw makeHttpError("Informe ao menos dois pontos para a conexao.");
  }

  const colorValue = normalizeText(payload.color ?? existing.color, DEFAULT_CONNECTION_COLOR_BY_LAYER[layer]);

  return {
    layer,
    connectionType,
    label: nullableText(payload.label ?? existing.label),
    sourceObjectId: nullableText(payload.sourceObjectId ?? payload.source_object_id ?? existing.sourceObjectId),
    targetObjectId: nullableText(payload.targetObjectId ?? payload.target_object_id ?? existing.targetObjectId),
    sourceAssetId: nullableText(payload.sourceAssetId ?? payload.source_asset_id ?? existing.sourceAssetId),
    targetAssetId: nullableText(payload.targetAssetId ?? payload.target_asset_id ?? existing.targetAssetId),
    points,
    color: isHexColor(colorValue) ? colorValue : DEFAULT_CONNECTION_COLOR_BY_LAYER[layer],
    thickness: numberInRange(payload.thickness ?? existing.thickness, 2, 1, 12),
    dashed: Boolean(payload.dashed ?? existing.dashed ?? false),
    notes: nullableText(payload.notes ?? existing.notes),
    metadata: parseMetadata(payload.metadata ?? payload.metadataJson ?? payload.metadata_json ?? existing.metadata)
  };
}

function mapFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    environmentId: row.environment_id,
    groupId: row.group_id,
    segmentId: row.segment_id,
    floorLabel: row.floor_label,
    width: Number(row.width),
    depth: Number(row.depth),
    scale: Number(row.scale),
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectCount: Number(row.object_count || 0)
  };
}

function objectFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    layer: row.layer,
    presetType: row.preset_type,
    objectType: row.preset_type,
    label: row.label,
    linkedAssetId: row.linked_asset_id,
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    positionZ: Number(row.position_z),
    rotationX: Number(row.rotation_x),
    rotationY: Number(row.rotation_y),
    rotationZ: Number(row.rotation_z),
    width: Number(row.width),
    depth: Number(row.depth),
    height: Number(row.height),
    color: row.color,
    notes: row.notes,
    metadata: parseJsonField(row.metadata),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function connectionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    layer: row.layer,
    connectionType: row.connection_type,
    label: row.label,
    sourceObjectId: row.source_object_id,
    targetObjectId: row.target_object_id,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    points: parsePoints(row.points_json),
    color: row.color,
    thickness: Number(row.thickness),
    dashed: Boolean(row.dashed),
    notes: row.notes,
    metadata: parseJsonField(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getMapOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_maps WHERE id = $1", [id]);
  const map = mapFromRow(result.rows[0]);
  if (!map) throw makeHttpError("Mapa visual nao encontrado.", 404);
  return map;
}

async function getObjectOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_map_objects WHERE id = $1", [id]);
  const object = objectFromRow(result.rows[0]);
  if (!object) throw makeHttpError("Objeto do mapa visual nao encontrado.", 404);
  return object;
}

async function getConnectionOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_map_connections WHERE id = $1", [id]);
  const connection = connectionFromRow(result.rows[0]);
  if (!connection) throw makeHttpError("Conexao do mapa visual nao encontrada.", 404);
  return connection;
}

async function ensureObjectsBelongToMap(mapId, objectIds, db = query) {
  const ids = [...new Set(objectIds.filter(Boolean))];
  for (const objectId of ids) {
    const object = await getObjectOrThrow(objectId, db);
    if (object.mapId !== mapId) {
      throw makeHttpError("Objeto informado pertence a outro mapa visual.");
    }
  }
}

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

async function ensureAssetLinkAvailable(mapId, linkedAssetId, excludeObjectId = null, db = query) {
  if (!linkedAssetId) return;

  const result = await db(
    `
      SELECT id
      FROM inventory_visual_map_objects
      WHERE map_id = $1
        AND linked_asset_id = $2
        AND ($3::text IS NULL OR id <> $3)
      LIMIT 1
    `,
    [mapId, linkedAssetId, excludeObjectId]
  );

  if (result.rows.length) {
    throw makeHttpError("Este ativo ja esta posicionado neste mapa visual.", 409);
  }
}

export async function listInventoryVisualMaps() {
  const result = await query(`
    SELECT *, 0 AS object_count
    FROM inventory_visual_maps
    ORDER BY updated_at DESC, created_at DESC
  `);

  const maps = result.rows.map(mapFromRow);
  if (!maps.length) return maps;

  const countResult = await query(`
    SELECT map_id, COUNT(*) AS object_count
    FROM inventory_visual_map_objects
    GROUP BY map_id
  `);
  const countByMapId = new Map(countResult.rows.map((row) => [row.map_id, Number(row.object_count || 0)]));

  return maps.map((map) => ({
    ...map,
    objectCount: countByMapId.get(map.id) || 0
  }));
}

export async function getInventoryVisualMap(id) {
  return getMapOrThrow(id);
}

export async function createInventoryVisualMap(payload, user) {
  const data = normalizeMapPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const result = await db(
      `
        INSERT INTO inventory_visual_maps (
          id, name, environment_id, group_id, segment_id, floor_label,
          width, depth, scale, notes, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        RETURNING *
      `,
      [
        id,
        data.name,
        data.environmentId,
        data.groupId,
        data.segmentId,
        data.floorLabel,
        data.width,
        data.depth,
        data.scale,
        data.notes,
        user?.id || null
      ]
    );

    await addLog({
      type: "inventory.visual_map.created",
      message: `Mapa visual criado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return mapFromRow(result.rows[0]);
  });
}

export async function updateInventoryVisualMap(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    const data = normalizeMapPayload(payload, existing);
    const result = await db(
      `
        UPDATE inventory_visual_maps
        SET name = $2,
            environment_id = $3,
            group_id = $4,
            segment_id = $5,
            floor_label = $6,
            width = $7,
            depth = $8,
            scale = $9,
            notes = $10,
            updated_by = $11,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        data.name,
        data.environmentId,
        data.groupId,
        data.segmentId,
        data.floorLabel,
        data.width,
        data.depth,
        data.scale,
        data.notes,
        user?.id || null
      ]
    );

    await addLog({
      type: "inventory.visual_map.updated",
      message: `Mapa visual atualizado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return mapFromRow(result.rows[0]);
  });
}

export async function deleteInventoryVisualMap(id, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    await db("DELETE FROM inventory_visual_maps WHERE id = $1", [id]);
    await addLog({
      type: "inventory.visual_map.deleted",
      message: `Mapa visual removido: ${existing.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });
    return existing;
  });
}

export async function listInventoryVisualMapObjects(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    `
      SELECT *
      FROM inventory_visual_map_objects
      WHERE map_id = $1
      ORDER BY layer ASC, created_at ASC
    `,
    [mapId]
  );

  return result.rows.map(objectFromRow);
}

export async function listInventoryVisualMapConnections(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    `
      SELECT *
      FROM inventory_visual_map_connections
      WHERE map_id = $1
      ORDER BY layer ASC, created_at ASC
    `,
    [mapId]
  );

  return result.rows.map(connectionFromRow);
}

export async function createInventoryVisualMapObject(mapId, payload, user) {
  const data = normalizeObjectPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await getMapOrThrow(mapId, db);
    await ensureAssetsExist([data.linkedAssetId], db);
    await ensureAssetLinkAvailable(mapId, data.linkedAssetId, null, db);
    const result = await db(
      `
        INSERT INTO inventory_visual_map_objects (
          id, map_id, layer, preset_type, label, linked_asset_id,
          position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
          width, depth, height, color, notes, metadata, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18::jsonb, $19, $19
        )
        RETURNING *
      `,
      [
        id,
        mapId,
        data.layer,
        data.presetType,
        data.label,
        data.linkedAssetId,
        data.positionX,
        data.positionY,
        data.positionZ,
        data.rotationX,
        data.rotationY,
        data.rotationZ,
        data.width,
        data.depth,
        data.height,
        data.color,
        data.notes,
        JSON.stringify(data.metadata),
        user?.id || null
      ]
    );

    if (data.linkedAssetId) {
      await addAssetHistory({
        assetId: data.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Ativo posicionado no mapa visual ${map.name}.`,
        newValue: data.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.created",
      message: `Objeto criado no mapa visual: ${data.label}.`,
      userId: user?.id,
      meta: { mapId, objectId: id, linkedAssetId: data.linkedAssetId },
      db
    });

    return objectFromRow(result.rows[0]);
  });
}

export async function updateInventoryVisualMapObject(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getObjectOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    const data = normalizeObjectPayload(payload, existing);
    await ensureAssetsExist([data.linkedAssetId], db);
    await ensureAssetLinkAvailable(existing.mapId, data.linkedAssetId, id, db);
    const result = await db(
      `
        UPDATE inventory_visual_map_objects
        SET layer = $2,
            preset_type = $3,
            label = $4,
            linked_asset_id = $5,
            position_x = $6,
            position_y = $7,
            position_z = $8,
            rotation_x = $9,
            rotation_y = $10,
            rotation_z = $11,
            width = $12,
            depth = $13,
            height = $14,
            color = $15,
            notes = $16,
            metadata = $17::jsonb,
            updated_by = $18,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        data.layer,
        data.presetType,
        data.label,
        data.linkedAssetId,
        data.positionX,
        data.positionY,
        data.positionZ,
        data.rotationX,
        data.rotationY,
        data.rotationZ,
        data.width,
        data.depth,
        data.height,
        data.color,
        data.notes,
        JSON.stringify(data.metadata),
        user?.id || null
      ]
    );

    if (data.linkedAssetId) {
      await addAssetHistory({
        assetId: data.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Posicao do ativo atualizada no mapa visual ${map.name}.`,
        newValue: data.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.updated",
      message: `Objeto atualizado no mapa visual: ${data.label}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, objectId: id, linkedAssetId: data.linkedAssetId },
      db
    });

    return objectFromRow(result.rows[0]);
  });
}

export async function deleteInventoryVisualMapObject(id, user) {
  return withTransaction(async (db) => {
    const existing = await getObjectOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    await db("DELETE FROM inventory_visual_map_objects WHERE id = $1", [id]);

    if (existing.linkedAssetId) {
      await addAssetHistory({
        assetId: existing.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Ativo removido do mapa visual ${map.name}.`,
        oldValue: existing.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.deleted",
      message: `Objeto removido do mapa visual: ${existing.label}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, objectId: id, linkedAssetId: existing.linkedAssetId },
      db
    });

    return existing;
  });
}

export async function createInventoryVisualMapConnection(mapId, payload, user) {
  const data = normalizeConnectionPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await getMapOrThrow(mapId, db);
    await ensureObjectsBelongToMap(mapId, [data.sourceObjectId, data.targetObjectId], db);
    await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);

    const result = await db(
      `
        INSERT INTO inventory_visual_map_connections (
          id, map_id, layer, connection_type, label,
          source_object_id, target_object_id, source_asset_id, target_asset_id,
          points_json, color, thickness, dashed, notes, metadata_json
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10::jsonb, $11, $12, $13, $14, $15::jsonb
        )
        RETURNING *
      `,
      [
        id,
        mapId,
        data.layer,
        data.connectionType,
        data.label,
        data.sourceObjectId,
        data.targetObjectId,
        data.sourceAssetId,
        data.targetAssetId,
        JSON.stringify(data.points),
        data.color,
        data.thickness,
        data.dashed,
        data.notes,
        JSON.stringify(data.metadata)
      ]
    );

    await addLog({
      type: "inventory.visual_map.connection.created",
      message: `Conexao criada no mapa visual ${map.name}.`,
      userId: user?.id,
      meta: { mapId, connectionId: id, layer: data.layer, connectionType: data.connectionType },
      db
    });

    return connectionFromRow(result.rows[0]);
  });
}

export async function updateInventoryVisualMapConnection(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getConnectionOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    const data = normalizeConnectionPayload(payload, existing);
    await ensureObjectsBelongToMap(existing.mapId, [data.sourceObjectId, data.targetObjectId], db);
    await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);

    const result = await db(
      `
        UPDATE inventory_visual_map_connections
        SET layer = $2,
            connection_type = $3,
            label = $4,
            source_object_id = $5,
            target_object_id = $6,
            source_asset_id = $7,
            target_asset_id = $8,
            points_json = $9::jsonb,
            color = $10,
            thickness = $11,
            dashed = $12,
            notes = $13,
            metadata_json = $14::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        data.layer,
        data.connectionType,
        data.label,
        data.sourceObjectId,
        data.targetObjectId,
        data.sourceAssetId,
        data.targetAssetId,
        JSON.stringify(data.points),
        data.color,
        data.thickness,
        data.dashed,
        data.notes,
        JSON.stringify(data.metadata)
      ]
    );

    await addLog({
      type: "inventory.visual_map.connection.updated",
      message: `Conexao atualizada no mapa visual ${map.name}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, connectionId: id, layer: data.layer, connectionType: data.connectionType },
      db
    });

    return connectionFromRow(result.rows[0]);
  });
}

export async function deleteInventoryVisualMapConnection(id, user) {
  return withTransaction(async (db) => {
    const existing = await getConnectionOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    await db("DELETE FROM inventory_visual_map_connections WHERE id = $1", [id]);

    await addLog({
      type: "inventory.visual_map.connection.deleted",
      message: `Conexao removida do mapa visual ${map.name}.`,
      userId: user?.id,
      meta: {
        mapId: existing.mapId,
        connectionId: id,
        layer: existing.layer,
        connectionType: existing.connectionType
      },
      db
    });

    return existing;
  });
}
