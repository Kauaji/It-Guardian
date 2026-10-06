import { randomUUID } from "node:crypto";
import { validateFloorPlanEditorData } from "../floorPlanValidation.js";

/** @import { CableRoute, ConnectionPoint, EditorData, Floor, FloorObject, FloorPlan, FloorPlanPayload, FloorPlanSource, FloorZone, NormalizedEditorChildren, RawEditorItem } from "./types.js" */

const PLAN_STATUSES = new Set(["draft", "active", "archived"]);

const ZONE_TYPES = new Set(["room", "group", "segment"]);

const POINT_TYPES = new Set(["network", "power"]);

const ROUTE_TYPES = new Set(["network", "power"]);

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function nullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} `#rrggbb` valido ou `fallback`.
 */
function normalizeColor(value, fallback = "#2563eb") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @param {{ min?: number, max?: number }} [limits]
 * @returns {number}
 */
function normalizeNumber(value, fallback = 0, { min = -100000, max = 100000 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @param {{ min?: number, max?: number }} [limits]
 * @returns {number}
 */
function normalizeInteger(value, fallback = 0, { min = -100000, max = 100000 } = {}) {
  return Math.round(normalizeNumber(value, fallback, { min, max }));
}

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} [fallback]
 * @returns {Record<string, unknown>}
 */
function normalizeMetadata(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return /** @type {Record<string, unknown>} */ (value);
  return fallback;
}

/**
 * @param {unknown} value
 * @returns {{ x?: unknown, y?: unknown }[]} Pontos do caminho (cada um validado depois por `validateFloorPlanEditorData`).
 */
function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Valor `candidate` quando esta entre os permitidos, senao `fallback`.
 * @param {Set<string>} allowed
 * @param {unknown} candidate
 * @param {string} fallback
 * @returns {string}
 */
function pickAllowed(allowed, candidate, fallback) {
  return typeof candidate === "string" && allowed.has(candidate) ? candidate : fallback;
}

/**
 * Andar do item (`floorId`/`floor_id`) quando existe na planta, senao o andar padrao.
 * @param {RawEditorItem} item
 * @param {Set<string>} validFloorIds
 * @param {string} fallbackFloorId
 * @returns {string}
 */
function resolveFloorId(item, validFloorIds, fallbackFloorId) {
  return pickAllowed(validFloorIds, item.floorId || item.floor_id, fallbackFloorId);
}

/**
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
  return value != null;
}

/**
 * @param {{ id?: string | null } | null | undefined} user
 * @returns {string | null}
 */
export function getUserId(user) {
  return user?.id || null;
}

/**
 * @param {FloorPlanPayload} [payload]
 * @param {Partial<FloorPlan>} [existing]
 * @returns {FloorPlan}
 */
export function normalizePlanPayload(payload = {}, existing = {}) {
  const status = pickAllowed(PLAN_STATUSES, payload.status, existing.status || "draft");
  return {
    inventoryTabId: nullableText(payload.inventoryTabId ?? payload.inventory_tab_id ?? existing.inventoryTabId),
    name: normalizeText(payload.name ?? existing.name, "Planta sem nome"),
    company: nullableText(payload.company ?? existing.company),
    unit: nullableText(payload.unit ?? existing.unit),
    floorLabel: nullableText(payload.floorLabel ?? payload.floor_label ?? existing.floorLabel),
    status,
    width: normalizeNumber(payload.width ?? existing.width, 1280, { min: 400, max: 12000 }),
    height: normalizeNumber(payload.height ?? existing.height, 820, { min: 300, max: 12000 }),
    gridSize: normalizeNumber(payload.gridSize ?? payload.grid_size ?? existing.gridSize, 25, { min: 5, max: 500 }),
    snapSize: normalizeNumber(payload.snapSize ?? payload.snap_size ?? existing.snapSize, 25, { min: 1, max: 500 }),
    activeFloorId: nullableText(payload.activeFloorId ?? payload.active_floor_id ?? existing.activeFloorId)
  };
}

/**
 * @param {RawEditorItem} item
 * @param {Partial<FloorPlan>} plan
 * @param {number} [fallbackIndex]
 * @returns {Floor}
 */
function normalizeFloorPayload(item = {}, plan, fallbackIndex = 0) {
  return {
    id: nullableText(item.id) || randomUUID(),
    name: normalizeText(item.name, fallbackIndex === 0 ? "Planta 1 - Terreo" : `Planta ${fallbackIndex + 1}`),
    level: normalizeInteger(item.level, fallbackIndex + 1, { min: -20, max: 200 }),
    width: normalizeNumber(item.width, plan.width || 1280, { min: 400, max: 12000 }),
    height: normalizeNumber(item.height, plan.height || 820, { min: 300, max: 12000 }),
    backgroundUrl: nullableText(item.backgroundUrl ?? item.background_url),
    metadata: normalizeMetadata(item.metadata)
  };
}

/**
 * @param {RawEditorItem} item
 * @param {string} planId
 * @param {Set<string>} validFloorIds
 * @param {string} fallbackFloorId
 * @param {number} index
 * @returns {FloorZone}
 */
function normalizeZonePayload(item = {}, planId, validFloorIds, fallbackFloorId, index) {
  const floorId = resolveFloorId(item, validFloorIds, fallbackFloorId);
  const zoneType = pickAllowed(ZONE_TYPES, item.zoneType || item.zone_type, "room");
  const geometry = normalizeMetadata(item.geometry, {});
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    zoneType,
    groupId: nullableText(item.groupId ?? item.group_id),
    segmentId: nullableText(item.segmentId ?? item.segment_id),
    name: normalizeText(item.name, zoneType === "segment" ? "Segmento" : zoneType === "group" ? "Grupo" : "Ambiente"),
    color: normalizeColor(item.color, zoneType === "segment" ? "#22c55e" : zoneType === "group" ? "#8b5cf6" : "#64748b"),
    geometry,
    orderIndex: normalizeInteger(item.orderIndex ?? item.order_index, index, { min: 0, max: 10000 }),
    metadata: normalizeMetadata(item.metadata)
  };
}

/**
 * @param {RawEditorItem} item
 * @param {string} planId
 * @param {Set<string>} validFloorIds
 * @param {string} fallbackFloorId
 * @returns {FloorObject}
 */
function normalizeObjectPayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = resolveFloorId(item, validFloorIds, fallbackFloorId);
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    objectType: normalizeText(item.objectType ?? item.object_type, "pc"),
    category: normalizeText(item.category, "asset"),
    label: normalizeText(item.label, "Ativo"),
    linkedAssetId: nullableText(item.linkedAssetId ?? item.linked_asset_id),
    groupId: nullableText(item.groupId ?? item.group_id),
    segmentId: nullableText(item.segmentId ?? item.segment_id),
    x: normalizeNumber(item.x, 120, { min: -12000, max: 12000 }),
    y: normalizeNumber(item.y, 120, { min: -12000, max: 12000 }),
    width: normalizeNumber(item.width, 88, { min: 8, max: 3000 }),
    height: normalizeNumber(item.height, 64, { min: 8, max: 3000 }),
    rotation: normalizeNumber(item.rotation, 0, { min: -360, max: 360 }),
    z: normalizeNumber(item.z, 0, { min: -1000, max: 1000 }),
    height3d: normalizeNumber(item.height3d ?? item.height_3d, 1, { min: 0.1, max: 600 }),
    color: normalizeColor(item.color, "#2563eb"),
    metadata: normalizeMetadata(item.metadata)
  };
}

/**
 * @param {RawEditorItem} item
 * @param {string} planId
 * @param {Set<string>} validFloorIds
 * @param {string} fallbackFloorId
 * @returns {ConnectionPoint}
 */
function normalizePointPayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = resolveFloorId(item, validFloorIds, fallbackFloorId);
  const pointType = pickAllowed(POINT_TYPES, item.pointType || item.point_type, "network");
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    pointType,
    // label e NOT NULL no banco: sem texto, usa o nome padrao do tipo.
    label: normalizeText(item.label, pointType === "power" ? "Tomada" : "Ponto de rede"),
    linkedObjectId: nullableText(item.linkedObjectId ?? item.linked_object_id),
    x: normalizeNumber(item.x, 120, { min: -12000, max: 12000 }),
    y: normalizeNumber(item.y, 120, { min: -12000, max: 12000 }),
    metadata: normalizeMetadata(item.metadata)
  };
}

/**
 * @param {RawEditorItem} item
 * @param {string} planId
 * @param {Set<string>} validFloorIds
 * @param {string} fallbackFloorId
 * @returns {CableRoute}
 */
function normalizeRoutePayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = resolveFloorId(item, validFloorIds, fallbackFloorId);
  const routeType = pickAllowed(ROUTE_TYPES, item.routeType || item.route_type, "network");
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    routeType,
    // label e color sao NOT NULL no banco: sem valor, usa padroes do tipo.
    label: normalizeText(item.label, routeType === "power" ? "Cabo de energia" : "Cabo de rede"),
    sourcePointId: nullableText(item.sourcePointId ?? item.source_point_id),
    targetPointId: nullableText(item.targetPointId ?? item.target_point_id),
    path: normalizeJsonArray(item.path),
    color: nullableText(item.color) ?? "#2563eb",
    metadata: normalizeMetadata(item.metadata)
  };
}

/**
 * @param {string} planId
 * @param {EditorData} data
 * @returns {NormalizedEditorChildren}
 * @throws {Error} 400 quando os dados do editor sao inconsistentes.
 */
export function normalizeEditorChildren(planId, data) {
  const floors = data.floors;
  const validFloorIds = new Set(floors.map((floor) => floor.id));
  const fallbackFloorId = floors[0].id;
  // Entradas nulas/nao objeto da lista crua antes derrubavam a gravacao com TypeError (500).
  const zones = (data.zones || [])
    .filter(isPresent)
    .map((item, index) => normalizeZonePayload(item, planId, validFloorIds, fallbackFloorId, index));
  const objects = (data.objects || [])
    .filter(isPresent)
    .map((item) => normalizeObjectPayload(item, planId, validFloorIds, fallbackFloorId));
  const connectionPoints = (data.connectionPoints || data.connection_points || [])
    .filter(isPresent)
    .map((item) => normalizePointPayload(item, planId, validFloorIds, fallbackFloorId));
  const cableRoutes = (data.cableRoutes || data.cable_routes || [])
    .filter(isPresent)
    .map((item) => normalizeRoutePayload(item, planId, validFloorIds, fallbackFloorId));
  const normalized = { floors, zones, objects, connectionPoints, cableRoutes };
  validateFloorPlanEditorData(normalized);
  return { ...normalized, fallbackFloorId };
}

/**
 * @param {FloorPlanPayload} payload
 * @param {Partial<FloorPlan>} plan
 * @returns {EditorData}
 */
export function normalizeEditorData(payload = {}, plan) {
  const payloadFloors = Array.isArray(payload.floors) ? payload.floors.filter(isPresent) : [];
  const floorsSource = payloadFloors.length
    ? payloadFloors
    : [{ id: payload.activeFloorId || randomUUID(), name: plan.floorLabel || "Planta 1 - Terreo" }];
  const floors = floorsSource.map((item, index) => normalizeFloorPayload(item, plan, index));
  return {
    floors,
    zones: Array.isArray(payload.zones) ? payload.zones : [],
    objects: Array.isArray(payload.objects) ? payload.objects : [],
    connectionPoints: Array.isArray(payload.connectionPoints) ? payload.connectionPoints : [],
    cableRoutes: Array.isArray(payload.cableRoutes) ? payload.cableRoutes : []
  };
}

/**
 * Andar ativo: o informado no plano quando existe entre os andares, senao o primeiro.
 *
 * @param {{ activeFloorId?: string | null }} plan
 * @param {{ id: string }[]} floors
 * @returns {string}
 */
export function resolveActiveFloorId(plan, floors) {
  return plan.activeFloorId && floors.some((floor) => floor.id === plan.activeFloorId) ? plan.activeFloorId : floors[0].id;
}

/**
 * Copia de uma planta: gera ids novos para andares, zonas, objetos, pontos e
 * rotas e remapeia as referencias entre eles (funcao pura). Referencias que nao
 * existem na origem caem no andar ativo ou em nulo.
 *
 * @param {FloorPlanSource} source
 * @param {string} newPlanId
 */
export function planFloorPlanDuplicate(source, newPlanId) {
  const floorIdMap = new Map();
  const objectIdMap = new Map();
  const pointIdMap = new Map();
  const sourcePlan = source.plan;

  const floors = source.floors.map((floor) => {
    const nextId = randomUUID();
    floorIdMap.set(floor.id, nextId);
    return { ...floor, id: nextId };
  });
  const activeFloorId = floorIdMap.get(sourcePlan.activeFloorId) || floors[0]?.id || randomUUID();

  const zones = source.zones.map((zone) => ({
    ...zone,
    id: randomUUID(),
    planId: newPlanId,
    floorId: floorIdMap.get(zone.floorId) || activeFloorId
  }));
  const objects = source.objects.map((object) => {
    const nextId = randomUUID();
    objectIdMap.set(object.id, nextId);
    return {
      ...object,
      id: nextId,
      planId: newPlanId,
      floorId: floorIdMap.get(object.floorId) || activeFloorId
    };
  });
  const connectionPoints = source.connectionPoints.map((point) => {
    const nextId = randomUUID();
    pointIdMap.set(point.id, nextId);
    return {
      ...point,
      id: nextId,
      planId: newPlanId,
      floorId: floorIdMap.get(point.floorId) || activeFloorId,
      linkedObjectId: objectIdMap.get(point.linkedObjectId) || null
    };
  });
  const cableRoutes = source.cableRoutes.map((route) => ({
    ...route,
    id: randomUUID(),
    planId: newPlanId,
    floorId: floorIdMap.get(route.floorId) || activeFloorId,
    sourcePointId: pointIdMap.get(route.sourcePointId) || null,
    targetPointId: pointIdMap.get(route.targetPointId) || null
  }));

  return {
    name: `${sourcePlan.name} - copia`,
    activeFloorId,
    floors,
    zones,
    objects,
    connectionPoints,
    cableRoutes
  };
}
