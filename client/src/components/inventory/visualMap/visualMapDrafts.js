import { buildDefaultConnectionDraft } from "../inventoryVisualMapConnectionUtils.js";
import { LAYER_LABELS } from "./visualMapPresets.js";

export const EMPTY_MAP_DRAFT = {
  name: "",
  environmentId: "",
  groupId: "",
  segmentId: "",
  floorLabel: "",
  width: 30,
  depth: 20,
  scale: 1,
  notes: ""
};

const DEFAULT_POINT = { x: 0, y: 0.08, z: 0 };

export function numberInputValue(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function draftsMatch(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function layerLabel(layer) {
  return LAYER_LABELS[layer] || "Mapa";
}

export function getNextObjectPosition(objects, map) {
  const step = 1.5;
  const columns = Math.max(1, Math.floor(Math.min(Number(map?.width) || 30, 18) / step));
  const index = objects.length;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const startX = -((columns - 1) * step) / 2;
  const maxZ = Math.max(0, (Number(map?.depth) || 20) / 2 - 1);

  return {
    positionX: Number((startX + column * step).toFixed(1)),
    positionZ: Number(Math.min(maxZ, -maxZ + row * step).toFixed(1))
  };
}

export function mapToDraft(map) {
  if (!map) return EMPTY_MAP_DRAFT;
  return {
    name: map.name || "",
    environmentId: map.environmentId || "",
    groupId: map.groupId || "",
    segmentId: map.segmentId || "",
    floorLabel: map.floorLabel || "",
    width: map.width || 30,
    depth: map.depth || 20,
    scale: map.scale || 1,
    notes: map.notes || ""
  };
}

export function objectToDraft(object) {
  if (!object) return null;
  return {
    label: object.label || "",
    linkedAssetId: object.linkedAssetId || "",
    positionX: object.positionX ?? 0,
    positionY: object.positionY ?? 0,
    positionZ: object.positionZ ?? 0,
    rotationX: object.rotationX ?? 0,
    rotationY: object.rotationY ?? 0,
    rotationZ: object.rotationZ ?? 0,
    width: object.width ?? 1,
    depth: object.depth ?? 1,
    height: object.height ?? 1,
    color: object.color || "#2563eb",
    notes: object.notes || "",
    metadata: object.metadata || {}
  };
}

export function connectionToDraft(connection) {
  if (!connection) return null;
  return {
    layer: connection.layer || "infrastructure",
    connectionType: connection.connectionType || "network_cable",
    label: connection.label || "",
    sourceObjectId: connection.sourceObjectId || "",
    targetObjectId: connection.targetObjectId || "",
    sourceAssetId: connection.sourceAssetId || "",
    targetAssetId: connection.targetAssetId || "",
    points: Array.isArray(connection.points) ? connection.points : buildDefaultConnectionDraft(connection.layer).points,
    color: connection.color || "#0ea5e9",
    thickness: connection.thickness || 2,
    dashed: !!connection.dashed,
    notes: connection.notes || "",
    metadata: connection.metadata || {}
  };
}

// ---- payloads enviados a API ----

export function buildMapPayload(draft) {
  return {
    ...draft,
    width: numberInputValue(draft.width, 30),
    depth: numberInputValue(draft.depth, 20),
    scale: numberInputValue(draft.scale, 1)
  };
}

export function buildObjectPayload(draft) {
  return {
    ...draft,
    linkedAssetId: draft.linkedAssetId || null,
    positionX: numberInputValue(draft.positionX),
    positionY: numberInputValue(draft.positionY),
    positionZ: numberInputValue(draft.positionZ),
    rotationX: numberInputValue(draft.rotationX),
    rotationY: numberInputValue(draft.rotationY),
    rotationZ: numberInputValue(draft.rotationZ),
    width: numberInputValue(draft.width, 1),
    depth: numberInputValue(draft.depth, 1),
    height: numberInputValue(draft.height, 1)
  };
}

export function buildDuplicateObjectPayload(draft, fallbackLabel) {
  return {
    ...draft,
    label: `${draft.label || fallbackLabel} (cópia)`,
    linkedAssetId: null,
    positionX: numberInputValue(draft.positionX) + 0.5,
    positionZ: numberInputValue(draft.positionZ) + 0.5
  };
}

export function buildConnectionPayload(draft) {
  return {
    ...draft,
    sourceObjectId: draft.sourceObjectId || null,
    targetObjectId: draft.targetObjectId || null,
    sourceAssetId: draft.sourceAssetId || null,
    targetAssetId: draft.targetAssetId || null,
    points: (draft.points || []).map((point) => ({
      x: numberInputValue(point.x),
      y: numberInputValue(point.y, 0.08),
      z: numberInputValue(point.z)
    })),
    thickness: numberInputValue(draft.thickness, 2)
  };
}

// ---- transformacoes puras dos rascunhos ----

export function withObjectField(current, key, value) {
  return { ...(current || {}), [key]: value };
}

export function withObjectMetadata(current, key, value) {
  return {
    ...(current || {}),
    metadata: {
      ...(current?.metadata || {}),
      [key]: value
    }
  };
}

export function withConnectionField(current, key, value) {
  const base = current || buildDefaultConnectionDraft();
  if (key === "layer") {
    const defaults = buildDefaultConnectionDraft(value);
    return {
      ...base,
      layer: value,
      connectionType: defaults.connectionType,
      color: defaults.color
    };
  }
  return { ...base, [key]: value };
}

export function withConnectionPoint(current, index, key, value) {
  const points = [...(current?.points || [])];
  points[index] = {
    ...(points[index] || DEFAULT_POINT),
    [key]: value
  };
  return { ...(current || buildDefaultConnectionDraft()), points };
}

export function withAddedConnectionPoint(current) {
  const base = current || buildDefaultConnectionDraft();
  const points = [...(base.points || [])];
  const lastPoint = points[points.length - 1] || DEFAULT_POINT;
  return {
    ...base,
    points: [
      ...points,
      {
        x: numberInputValue(lastPoint.x) + 1,
        y: numberInputValue(lastPoint.y, 0.08),
        z: numberInputValue(lastPoint.z) + 1
      }
    ]
  };
}

export function withoutConnectionPoint(current, index) {
  const base = current || buildDefaultConnectionDraft();
  const points = (base.points || []).filter((_, pointIndex) => pointIndex !== index);
  return { ...base, points: points.length >= 2 ? points : base.points };
}

export function withConnectionMetadata(current, key, value) {
  return {
    ...(current || buildDefaultConnectionDraft()),
    metadata: {
      ...(current?.metadata || {}),
      [key]: value
    }
  };
}
