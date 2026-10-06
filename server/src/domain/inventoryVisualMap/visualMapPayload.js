import { makeHttpError } from "./visualMapErrors.js";
import {
  ALL_PRESETS,
  CONNECTION_LAYERS,
  CONNECTION_TYPES_BY_LAYER,
  DEFAULT_CONNECTION_BY_LAYER,
  DEFAULT_CONNECTION_COLOR_BY_LAYER,
  defaultsForPreset,
  resolveObjectLayer
} from "./visualMapVocabulary.js";

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

export function parseJsonField(value) {
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

export function parsePoints(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return [];
    }
  }

  return Array.isArray(value) ? value : [];
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
