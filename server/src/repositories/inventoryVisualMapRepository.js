import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";

export const STRUCTURE_PRESETS = new Set(["wall", "partition", "room", "corridor", "desk", "rack"]);

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

const ALL_PRESETS = new Set([...STRUCTURE_PRESETS, ...ASSET_PRESETS]);

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
  if (explicitLayer === "structure" || explicitLayer === "assets") return explicitLayer;
  return STRUCTURE_PRESETS.has(presetType) ? "structure" : "assets";
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

  const defaults = STRUCTURE_PRESETS.has(presetType)
    ? DEFAULT_STRUCTURE_DIMENSIONS[presetType]
    : DEFAULT_ASSET_DIMENSIONS[presetType];
  const layer = resolveObjectLayer(presetType, payload.layer ?? existing.layer);
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

export async function createInventoryVisualMapObject(mapId, payload, user) {
  const data = normalizeObjectPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await getMapOrThrow(mapId, db);
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
