import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { validateFloorPlanEditorData } from "../domain/floorPlanValidation.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";

const PLAN_STATUSES = new Set(["draft", "active", "archived"]);
const ZONE_TYPES = new Set(["room", "group", "segment"]);
const POINT_TYPES = new Set(["network", "power"]);
const ROUTE_TYPES = new Set(["network", "power"]);

function makeHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function nullableText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeColor(value, fallback = "#2563eb") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeNumber(value, fallback = 0, { min = -100000, max = 100000 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeInteger(value, fallback = 0, { min = -100000, max = 100000 } = {}) {
  return Math.round(normalizeNumber(value, fallback, { min, max }));
}

function normalizeMetadata(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return fallback;
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function getUserId(user) {
  return user?.id || null;
}

function mapPlan(row, counts = {}) {
  return {
    id: row.id,
    inventoryTabId: row.inventory_tab_id,
    name: row.name,
    company: row.company,
    unit: row.unit,
    floorLabel: row.floor_label,
    status: row.status,
    width: Number(row.width),
    height: Number(row.height),
    gridSize: Number(row.grid_size),
    snapSize: Number(row.snap_size),
    activeFloorId: row.active_floor_id,
    objectCount: counts.objectCount || 0,
    assetCount: counts.assetCount || 0,
    floorCount: counts.floorCount || 0,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFloor(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    level: Number(row.level),
    width: Number(row.width),
    height: Number(row.height),
    backgroundUrl: row.background_url,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapZone(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    zoneType: row.zone_type,
    groupId: row.group_id,
    segmentId: row.segment_id,
    name: row.name,
    color: row.color,
    geometry: row.geometry || {},
    orderIndex: Number(row.order_index || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapObject(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    objectType: row.object_type,
    category: row.category,
    label: row.label,
    linkedAssetId: row.linked_asset_id,
    groupId: row.group_id,
    segmentId: row.segment_id,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    rotation: Number(row.rotation),
    z: Number(row.z),
    height3d: Number(row.height_3d),
    color: row.color,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConnectionPoint(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    pointType: row.point_type,
    label: row.label,
    linkedObjectId: row.linked_object_id,
    x: Number(row.x),
    y: Number(row.y),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCableRoute(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    routeType: row.route_type,
    label: row.label,
    sourcePointId: row.source_point_id,
    targetPointId: row.target_point_id,
    path: row.path || [],
    color: row.color,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizePlanPayload(payload = {}, existing = {}) {
  const status = PLAN_STATUSES.has(payload.status) ? payload.status : existing.status || "draft";
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

function normalizeZonePayload(item = {}, planId, validFloorIds, fallbackFloorId, index) {
  const floorId = validFloorIds.has(item.floorId || item.floor_id) ? item.floorId || item.floor_id : fallbackFloorId;
  const zoneType = ZONE_TYPES.has(item.zoneType || item.zone_type) ? item.zoneType || item.zone_type : "room";
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

function normalizeObjectPayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = validFloorIds.has(item.floorId || item.floor_id) ? item.floorId || item.floor_id : fallbackFloorId;
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
    height3d: normalizeNumber(item.height3d ?? item.height_3d, 1, { min: 0.1, max: 80 }),
    color: normalizeColor(item.color, "#2563eb"),
    metadata: normalizeMetadata(item.metadata)
  };
}

function normalizePointPayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = validFloorIds.has(item.floorId || item.floor_id) ? item.floorId || item.floor_id : fallbackFloorId;
  const pointType = POINT_TYPES.has(item.pointType || item.point_type) ? item.pointType || item.point_type : "network";
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    pointType,
    label: nullableText(item.label),
    linkedObjectId: nullableText(item.linkedObjectId ?? item.linked_object_id),
    x: normalizeNumber(item.x, 120, { min: -12000, max: 12000 }),
    y: normalizeNumber(item.y, 120, { min: -12000, max: 12000 }),
    metadata: normalizeMetadata(item.metadata)
  };
}

function normalizeRoutePayload(item = {}, planId, validFloorIds, fallbackFloorId) {
  const floorId = validFloorIds.has(item.floorId || item.floor_id) ? item.floorId || item.floor_id : fallbackFloorId;
  const routeType = ROUTE_TYPES.has(item.routeType || item.route_type) ? item.routeType || item.route_type : "network";
  return {
    id: nullableText(item.id) || randomUUID(),
    planId,
    floorId,
    routeType,
    label: nullableText(item.label),
    sourcePointId: nullableText(item.sourcePointId ?? item.source_point_id),
    targetPointId: nullableText(item.targetPointId ?? item.target_point_id),
    path: normalizeJsonArray(item.path),
    color: nullableText(item.color),
    metadata: normalizeMetadata(item.metadata)
  };
}

async function getPlanRowOrThrow(id, db = query) {
  const result = await db("SELECT * FROM floor_plans WHERE id = $1", [id]);
  const row = result.rows[0];
  if (!row) throw makeHttpError(404, "Planta nao encontrada.");
  return row;
}

async function loadBundle(planId, db = query) {
  const planRow = await getPlanRowOrThrow(planId, db);
  const [floors, zones, objects, connectionPoints, cableRoutes] = await Promise.all([
    db("SELECT * FROM floor_plan_floors WHERE plan_id = $1 ORDER BY level ASC, created_at ASC", [planId]),
    db("SELECT * FROM floor_plan_zones WHERE plan_id = $1 ORDER BY order_index ASC, created_at ASC", [planId]),
    db("SELECT * FROM floor_plan_objects WHERE plan_id = $1 ORDER BY created_at ASC", [planId]),
    db("SELECT * FROM floor_plan_connection_points WHERE plan_id = $1 ORDER BY created_at ASC", [planId]),
    db("SELECT * FROM floor_plan_cable_routes WHERE plan_id = $1 ORDER BY created_at ASC", [planId])
  ]);

  return {
    plan: mapPlan(planRow, {
      floorCount: floors.rows.length,
      objectCount: objects.rows.length,
      assetCount: objects.rows.filter((item) => item.linked_asset_id).length
    }),
    floors: floors.rows.map(mapFloor),
    zones: zones.rows.map(mapZone),
    objects: objects.rows.map(mapObject),
    connectionPoints: connectionPoints.rows.map(mapConnectionPoint),
    cableRoutes: cableRoutes.rows.map(mapCableRoute)
  };
}

export async function listFloorPlans(inventoryTabId = "") {
  const normalizedTabId = nullableText(inventoryTabId);
  const plansResult = normalizedTabId
    ? await query("SELECT * FROM floor_plans WHERE inventory_tab_id = $1 ORDER BY updated_at DESC, created_at DESC", [normalizedTabId])
    : await query("SELECT * FROM floor_plans ORDER BY updated_at DESC, created_at DESC");
  const [objectCounts, assetCounts, floorCounts] = await Promise.all([
    query("SELECT plan_id, COUNT(*)::int AS count FROM floor_plan_objects GROUP BY plan_id"),
    query("SELECT plan_id, COUNT(*)::int AS count FROM floor_plan_objects WHERE linked_asset_id IS NOT NULL GROUP BY plan_id"),
    query("SELECT plan_id, COUNT(*)::int AS count FROM floor_plan_floors GROUP BY plan_id")
  ]);

  const countMap = new Map();
  for (const row of objectCounts.rows) countMap.set(row.plan_id, { ...(countMap.get(row.plan_id) || {}), objectCount: Number(row.count) });
  for (const row of assetCounts.rows) countMap.set(row.plan_id, { ...(countMap.get(row.plan_id) || {}), assetCount: Number(row.count) });
  for (const row of floorCounts.rows) countMap.set(row.plan_id, { ...(countMap.get(row.plan_id) || {}), floorCount: Number(row.count) });

  return plansResult.rows.map((row) => mapPlan(row, countMap.get(row.id) || {}));
}

async function insertFloor(db, planId, floor) {
  await db(
    `
      INSERT INTO floor_plan_floors (
        id, plan_id, name, level, width, height, background_url, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [floor.id, planId, floor.name, floor.level, floor.width, floor.height, floor.backgroundUrl, JSON.stringify(floor.metadata)]
  );
}

async function insertZone(db, zone) {
  await db(
    `
      INSERT INTO floor_plan_zones (
        id, plan_id, floor_id, zone_type, group_id, segment_id, name, color, geometry, order_index, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb)
    `,
    [
      zone.id,
      zone.planId,
      zone.floorId,
      zone.zoneType,
      zone.groupId,
      zone.segmentId,
      zone.name,
      zone.color,
      JSON.stringify(zone.geometry),
      zone.orderIndex,
      JSON.stringify(zone.metadata)
    ]
  );
}

async function insertObject(db, object) {
  await db(
    `
      INSERT INTO floor_plan_objects (
        id, plan_id, floor_id, object_type, category, label, linked_asset_id,
        group_id, segment_id, x, y, width, height, rotation, z, height_3d, color, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb)
    `,
    [
      object.id,
      object.planId,
      object.floorId,
      object.objectType,
      object.category,
      object.label,
      object.linkedAssetId,
      object.groupId,
      object.segmentId,
      object.x,
      object.y,
      object.width,
      object.height,
      object.rotation,
      object.z,
      object.height3d,
      object.color,
      JSON.stringify(object.metadata)
    ]
  );
}

async function insertConnectionPoint(db, point) {
  await db(
    `
      INSERT INTO floor_plan_connection_points (
        id, plan_id, floor_id, point_type, label, linked_object_id, x, y, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [point.id, point.planId, point.floorId, point.pointType, point.label, point.linkedObjectId, point.x, point.y, JSON.stringify(point.metadata)]
  );
}

async function insertCableRoute(db, route) {
  await db(
    `
      INSERT INTO floor_plan_cable_routes (
        id, plan_id, floor_id, route_type, label, source_point_id, target_point_id, path, color, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb)
    `,
    [
      route.id,
      route.planId,
      route.floorId,
      route.routeType,
      route.label,
      route.sourcePointId,
      route.targetPointId,
      JSON.stringify(route.path),
      route.color,
      JSON.stringify(route.metadata)
    ]
  );
}

function normalizeEditorChildren(planId, data) {
  const floors = data.floors;
  const validFloorIds = new Set(floors.map((floor) => floor.id));
  const fallbackFloorId = floors[0].id;
  const zones = (data.zones || []).map((item, index) => normalizeZonePayload(item, planId, validFloorIds, fallbackFloorId, index));
  const objects = (data.objects || []).map((item) => normalizeObjectPayload(item, planId, validFloorIds, fallbackFloorId));
  const connectionPoints = (data.connectionPoints || data.connection_points || []).map((item) => (
    normalizePointPayload(item, planId, validFloorIds, fallbackFloorId)
  ));
  const cableRoutes = (data.cableRoutes || data.cable_routes || []).map((item) => (
    normalizeRoutePayload(item, planId, validFloorIds, fallbackFloorId)
  ));
  const normalized = { floors, zones, objects, connectionPoints, cableRoutes };
  validateFloorPlanEditorData(normalized);
  return { ...normalized, fallbackFloorId };
}

async function replaceEditorChildren(db, planId, data) {
  const { floors, zones, objects, connectionPoints, cableRoutes, fallbackFloorId } = normalizeEditorChildren(planId, data);

  await db("DELETE FROM floor_plan_cable_routes WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_connection_points WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_objects WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_zones WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_floors WHERE plan_id = $1", [planId]);

  for (const floor of floors) await insertFloor(db, planId, floor);
  for (const zone of zones) await insertZone(db, zone);
  for (const object of objects) await insertObject(db, object);
  for (const point of connectionPoints) await insertConnectionPoint(db, point);
  for (const route of cableRoutes) await insertCableRoute(db, route);

  return fallbackFloorId;
}

function normalizeEditorData(payload = {}, plan) {
  const floorsSource = Array.isArray(payload.floors) && payload.floors.length
    ? payload.floors
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

export async function getFloorPlan(id) {
  return loadBundle(id);
}

export async function createFloorPlan(payload = {}, user = {}) {
  const planId = randomUUID();
  const plan = normalizePlanPayload(payload.plan || payload);
  const editorData = normalizeEditorData(payload, plan);
  const activeFloorId = plan.activeFloorId && editorData.floors.some((floor) => floor.id === plan.activeFloorId)
    ? plan.activeFloorId
    : editorData.floors[0].id;

  return withTransaction(async (db) => {
    if (plan.inventoryTabId) {
      const existingPlan = await db("SELECT id FROM floor_plans WHERE inventory_tab_id = $1 LIMIT 1", [plan.inventoryTabId]);
      if (existingPlan.rows.length) throw makeHttpError(409, "Esta aba ja possui uma planta cadastrada.");
    }
    await db(
      `
        INSERT INTO floor_plans (
          id, inventory_tab_id, name, company, unit, floor_label, status, width, height, grid_size, snap_size,
          active_floor_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      `,
      [
        planId,
        plan.inventoryTabId,
        plan.name,
        plan.company,
        plan.unit,
        plan.floorLabel,
        plan.status,
        plan.width,
        plan.height,
        plan.gridSize,
        plan.snapSize,
        activeFloorId,
        getUserId(user)
      ]
    );

    await replaceEditorChildren(db, planId, editorData);
    await addLog({
      type: "floor_plan.created",
      message: `Planta ${plan.name} criada.`,
      userId: getUserId(user),
      meta: { planId },
      db
    });
    return loadBundle(planId, db);
  });
}

export async function updateFloorPlan(id, payload = {}, user = {}) {
  return withTransaction(async (db) => {
    const current = mapPlan(await getPlanRowOrThrow(id, db));
    const plan = normalizePlanPayload(payload, current);
    await db(
      `
        UPDATE floor_plans
        SET inventory_tab_id = $2,
            name = $3,
            company = $4,
            unit = $5,
            floor_label = $6,
            status = $7,
            width = $8,
            height = $9,
            grid_size = $10,
            snap_size = $11,
            active_floor_id = $12,
            updated_by = $13,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        plan.inventoryTabId,
        plan.name,
        plan.company,
        plan.unit,
        plan.floorLabel,
        plan.status,
        plan.width,
        plan.height,
        plan.gridSize,
        plan.snapSize,
        plan.activeFloorId,
        getUserId(user)
      ]
    );
    await addLog({
      type: "floor_plan.updated",
      message: `Planta ${plan.name} atualizada.`,
      userId: getUserId(user),
      meta: { planId: id },
      db
    });
    return loadBundle(id, db);
  });
}

export async function saveFloorPlanEditorData(id, payload = {}, user = {}) {
  return withTransaction(async (db) => {
    const current = mapPlan(await getPlanRowOrThrow(id, db));
    const plan = normalizePlanPayload(payload.plan || payload, current);
    const editorData = normalizeEditorData(payload, plan);
    const activeFloorId = plan.activeFloorId && editorData.floors.some((floor) => floor.id === plan.activeFloorId)
      ? plan.activeFloorId
      : editorData.floors[0].id;

    await db(
      `
        UPDATE floor_plans
        SET inventory_tab_id = $2,
            name = $3,
            company = $4,
            unit = $5,
            floor_label = $6,
            status = $7,
            width = $8,
            height = $9,
            grid_size = $10,
            snap_size = $11,
            active_floor_id = $12,
            updated_by = $13,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        plan.inventoryTabId,
        plan.name,
        plan.company,
        plan.unit,
        plan.floorLabel,
        plan.status,
        plan.width,
        plan.height,
        plan.gridSize,
        plan.snapSize,
        activeFloorId,
        getUserId(user)
      ]
    );

    await replaceEditorChildren(db, id, editorData);
    await addLog({
      type: "floor_plan.editor_saved",
      message: `Editor da planta ${plan.name} salvo.`,
      userId: getUserId(user),
      meta: {
        planId: id,
        floors: editorData.floors.length,
        objects: editorData.objects.length,
        zones: editorData.zones.length
      },
      db
    });
    return loadBundle(id, db);
  });
}

export async function duplicateFloorPlan(id, user = {}) {
  return withTransaction(async (db) => {
    const source = await loadBundle(id, db);
    const newPlanId = randomUUID();
    const floorIdMap = new Map();
    const objectIdMap = new Map();
    const pointIdMap = new Map();
    const sourcePlan = source.plan;
    const name = `${sourcePlan.name} - copia`;

    const floors = source.floors.map((floor) => {
      const nextId = randomUUID();
      floorIdMap.set(floor.id, nextId);
      return { ...floor, id: nextId };
    });
    const activeFloorId = floorIdMap.get(sourcePlan.activeFloorId) || floors[0]?.id || randomUUID();

    await db(
      `
        INSERT INTO floor_plans (
          id, name, company, unit, floor_label, status, width, height, grid_size, snap_size,
          active_floor_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $11)
      `,
      [
        newPlanId,
        name,
        sourcePlan.company,
        sourcePlan.unit,
        sourcePlan.floorLabel,
        sourcePlan.width,
        sourcePlan.height,
        sourcePlan.gridSize,
        sourcePlan.snapSize,
        activeFloorId,
        getUserId(user)
      ]
    );

    for (const floor of floors) await insertFloor(db, newPlanId, floor);
    for (const zone of source.zones) {
      await insertZone(db, {
        ...zone,
        id: randomUUID(),
        planId: newPlanId,
        floorId: floorIdMap.get(zone.floorId) || activeFloorId
      });
    }
    for (const object of source.objects) {
      const nextId = randomUUID();
      objectIdMap.set(object.id, nextId);
      await insertObject(db, {
        ...object,
        id: nextId,
        planId: newPlanId,
        floorId: floorIdMap.get(object.floorId) || activeFloorId
      });
    }
    for (const point of source.connectionPoints) {
      const nextId = randomUUID();
      pointIdMap.set(point.id, nextId);
      await insertConnectionPoint(db, {
        ...point,
        id: nextId,
        planId: newPlanId,
        floorId: floorIdMap.get(point.floorId) || activeFloorId,
        linkedObjectId: objectIdMap.get(point.linkedObjectId) || null
      });
    }
    for (const route of source.cableRoutes) {
      await insertCableRoute(db, {
        ...route,
        id: randomUUID(),
        planId: newPlanId,
        floorId: floorIdMap.get(route.floorId) || activeFloorId,
        sourcePointId: pointIdMap.get(route.sourcePointId) || null,
        targetPointId: pointIdMap.get(route.targetPointId) || null
      });
    }

    await addLog({
      type: "floor_plan.duplicated",
      message: `Planta ${sourcePlan.name} duplicada.`,
      userId: getUserId(user),
      meta: { sourcePlanId: id, planId: newPlanId },
      db
    });
    return loadBundle(newPlanId, db);
  });
}

export async function deleteFloorPlan(id, user = {}) {
  return withTransaction(async (db) => {
    const plan = mapPlan(await getPlanRowOrThrow(id, db));
    await db("DELETE FROM floor_plans WHERE id = $1", [id]);
    await addLog({
      type: "floor_plan.deleted",
      message: `Planta ${plan.name} removida.`,
      userId: getUserId(user),
      meta: { planId: id },
      db
    });
    return plan;
  });
}

export async function linkFloorPlanObject(objectId, payload = {}, user = {}) {
  const assetId = nullableText(payload.assetId ?? payload.linkedAssetId);
  return withTransaction(async (db) => {
    const objectResult = await db("SELECT * FROM floor_plan_objects WHERE id = $1", [objectId]);
    const current = objectResult.rows[0];
    if (!current) throw makeHttpError(404, "Objeto da planta nao encontrado.");

    const updatedResult = await db(
      `
        UPDATE floor_plan_objects
        SET linked_asset_id = $2,
            group_id = $3,
            segment_id = $4,
            label = COALESCE($5, label),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        objectId,
        assetId,
        nullableText(payload.groupId),
        nullableText(payload.segmentId),
        nullableText(payload.label)
      ]
    );
    const updated = mapObject(updatedResult.rows[0]);

    if (assetId) {
      await addAssetHistory({
        assetId,
        eventType: "floor_plan_linked",
        message: `Ativo vinculado a planta ${updated.planId}.`,
        oldValue: current.linked_asset_id,
        newValue: objectId,
        userId: getUserId(user),
        userName: user?.name || null,
        db
      });
    }

    await addLog({
      type: "floor_plan.object_linked",
      message: `Objeto ${updated.label} vinculado a ativo.`,
      userId: getUserId(user),
      meta: { planId: updated.planId, objectId, assetId },
      db
    });
    return updated;
  });
}
