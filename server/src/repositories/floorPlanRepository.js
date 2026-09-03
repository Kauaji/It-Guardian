import { createHash, randomUUID } from "node:crypto";
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
    height3d: normalizeNumber(item.height3d ?? item.height_3d, 1, { min: 0.1, max: 600 }),
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
  const backgroundResult = await db("SELECT * FROM floor_plan_backgrounds WHERE plan_id = $1", [planId]);

  await db("DELETE FROM floor_plan_cable_routes WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_connection_points WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_objects WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_zones WHERE plan_id = $1", [planId]);
  await db("DELETE FROM floor_plan_floors WHERE plan_id = $1", [planId]);

  for (const floor of floors) await insertFloor(db, planId, floor);
  const retainedFloorIds = new Set(floors.map((floor) => floor.id));
  for (const background of backgroundResult.rows.filter((item) => retainedFloorIds.has(item.floor_id))) {
    await db(
      `
        INSERT INTO floor_plan_backgrounds (
          id, plan_id, floor_id, file_name, mime_type, byte_size, sha256, file_data,
          created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        background.id,
        planId,
        background.floor_id,
        background.file_name,
        background.mime_type,
        background.byte_size,
        background.sha256,
        background.file_data,
        background.created_by,
        background.created_at,
        background.updated_at
      ]
    );
  }
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

const BACKGROUND_MIME_SIGNATURES = {
  "image/png": (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/webp": (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
};

export function validateFloorPlanBackground(buffer, mimeType, fileName = "planta") {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw makeHttpError(400, "Selecione uma imagem para a planta.");
  if (buffer.length > 8 * 1024 * 1024) throw makeHttpError(413, "A imagem deve ter no máximo 8 MB.");
  const normalizedMime = String(mimeType || "").split(";", 1)[0].trim().toLowerCase();
  if (!BACKGROUND_MIME_SIGNATURES[normalizedMime]?.(buffer)) throw makeHttpError(400, "Arquivo inválido. Envie PNG, JPG ou WEBP verdadeiro.");
  const extension = normalizedMime === "image/png" ? ".png" : normalizedMime === "image/webp" ? ".webp" : ".jpg";
  const base = String(fileName || "planta").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/\.(png|jpe?g|webp)$/i, "").slice(0, 100) || "planta";
  return { mimeType: normalizedMime, fileName: `${base}${extension}` };
}

export async function saveFloorPlanBackground(planId, floorId, buffer, mimeType, fileName, user = {}) {
  const clean = validateFloorPlanBackground(buffer, mimeType, fileName);
  const floor = await query("SELECT id FROM floor_plan_floors WHERE id=$1 AND plan_id=$2", [floorId, planId]);
  if (!floor.rowCount) throw makeHttpError(404, "Andar da planta não encontrado.");
  const id = randomUUID();
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  await query(`INSERT INTO floor_plan_backgrounds (id,plan_id,floor_id,file_name,mime_type,byte_size,sha256,file_data,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (floor_id) DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,byte_size=EXCLUDED.byte_size,sha256=EXCLUDED.sha256,file_data=EXCLUDED.file_data,created_by=EXCLUDED.created_by,updated_at=NOW()`, [id,planId,floorId,clean.fileName,clean.mimeType,buffer.length,sha256,buffer,getUserId(user)]);
  await query("UPDATE floor_plan_floors SET background_url=$2, updated_at=NOW() WHERE id=$1", [floorId, `/api/floor-plans/${planId}/floors/${floorId}/background`]);
  await addLog({
    type: "floor_plan.background_uploaded",
    message: `Imagem de fundo da planta ${planId} atualizada.`,
    userId: getUserId(user),
    meta: { planId, floorId, mimeType: clean.mimeType, byteSize: buffer.length, sha256 }
  });
  return { floorId, fileName: clean.fileName, mimeType: clean.mimeType, byteSize: buffer.length, sha256, backgroundUrl: `/api/floor-plans/${planId}/floors/${floorId}/background` };
}

export async function getFloorPlanBackground(planId, floorId) {
  const result = await query("SELECT file_name,mime_type,byte_size,sha256,file_data,updated_at FROM floor_plan_backgrounds WHERE plan_id=$1 AND floor_id=$2", [planId,floorId]);
  if (!result.rowCount) throw makeHttpError(404, "Imagem de fundo não encontrada.");
  return result.rows[0];
}

export async function removeFloorPlanBackground(planId, floorId, user = {}) {
  const result = await query("DELETE FROM floor_plan_backgrounds WHERE plan_id=$1 AND floor_id=$2 RETURNING floor_id", [planId,floorId]);
  if (!result.rowCount) throw makeHttpError(404, "Imagem de fundo não encontrada.");
  await query("UPDATE floor_plan_floors SET background_url=NULL, updated_at=NOW() WHERE id=$1 AND plan_id=$2", [floorId,planId]);
  await addLog({
    type: "floor_plan.background_removed",
    message: `Imagem de fundo da planta ${planId} removida.`,
    userId: getUserId(user),
    meta: { planId, floorId }
  });
  return { floorId };
}

async function infrastructureRows(planId) {
  await getPlanRowOrThrow(planId);
  const [objects, assets, alerts, orders] = await Promise.all([
    query("SELECT id,label,linked_asset_id,group_id,segment_id,category,object_type FROM floor_plan_objects WHERE plan_id=$1", [planId]),
    query("SELECT asset_id,hostname,machine_alias,cpu_usage_percent,memory_total_bytes,memory_used_bytes,disk_total_bytes,disk_free_bytes,last_seen_at,interval_seconds FROM agent_assets"),
    query("SELECT asset_id,severity,status FROM alerts WHERE status='active'"),
    query("SELECT asset_id,status,priority,sla_due_at,created_at,closed_at FROM service_orders WHERE asset_id IS NOT NULL")
  ]);
  return { objects: objects.rows, assets: assets.rows, alerts: alerts.rows, orders: orders.rows };
}

function assetHeatmapSeverity(metric, value, status) {
  if (metric === "availability") {
    return status === "online" ? "low" : status === "offline" ? "critical" : "medium";
  }
  if (metric === "alerts" || metric === "service_orders") {
    return value >= 5 ? "critical" : value >= 3 ? "high" : value >= 1 ? "medium" : "low";
  }
  return value >= 85 ? "critical" : value >= 65 ? "high" : value >= 35 ? "medium" : "low";
}

function assetSnapshot(asset) {
  if (!asset) return { status: "no_agent", cpu: null, ram: null, disk: null, lastSeenAt: null };
  const ram = Number(asset.memory_total_bytes) > 0 ? Math.round(Number(asset.memory_used_bytes || 0) / Number(asset.memory_total_bytes) * 100) : null;
  const disk = Number(asset.disk_total_bytes) > 0 ? Math.round((1 - Number(asset.disk_free_bytes || 0) / Number(asset.disk_total_bytes)) * 100) : null;
  const age = Date.now() - new Date(asset.last_seen_at).getTime();
  const status = age <= Math.max(180_000, Number(asset.interval_seconds || 60) * 3_000) ? "online" : "offline";
  return { status, cpu: asset.cpu_usage_percent == null ? null : Number(asset.cpu_usage_percent), ram, disk, lastSeenAt: asset.last_seen_at, name: asset.machine_alias || asset.hostname };
}

function filterInfrastructureObjects(objects, { groupId, segmentId } = {}) {
  return objects.filter((item) => (
    (!groupId || item.group_id === groupId)
    && (!segmentId || item.segment_id === segmentId)
  ));
}

export async function getFloorPlanAssetHeatmap(planId, metric = "availability", filters = {}) {
  const allowedMetrics = new Set(["availability", "cpu", "ram", "disk", "alerts", "service_orders"]);
  if (!allowedMetrics.has(metric)) throw makeHttpError(400, "Métrica de ativos inválida.");
  const data = await infrastructureRows(planId);
  const assetMap = new Map(data.assets.map((item) => [item.asset_id, item]));
  const alertsByAsset = new Map();
  for (const alert of data.alerts) {
    alertsByAsset.set(alert.asset_id, (alertsByAsset.get(alert.asset_id) || 0) + 1);
  }
  const ordersByAsset = new Map();
  for (const order of data.orders) {
    ordersByAsset.set(order.asset_id, (ordersByAsset.get(order.asset_id) || 0) + 1);
  }
  const components = filterInfrastructureObjects(data.objects, filters)
    .filter((item) => item.linked_asset_id)
    .map((item) => {
      const snapshot = assetSnapshot(assetMap.get(item.linked_asset_id));
      const value = metric === "cpu" ? snapshot.cpu
        : metric === "ram" ? snapshot.ram
          : metric === "disk" ? snapshot.disk
            : metric === "alerts" ? (alertsByAsset.get(item.linked_asset_id) || 0)
              : metric === "service_orders" ? (ordersByAsset.get(item.linked_asset_id) || 0)
                : snapshot.status === "online" ? 0 : snapshot.status === "offline" ? 100 : 50;
      return {
        componentId: item.id,
        assetId: item.linked_asset_id,
        label: item.label,
        ...snapshot,
        alerts: alertsByAsset.get(item.linked_asset_id) || 0,
        serviceOrders: ordersByAsset.get(item.linked_asset_id) || 0,
        score: value ?? 0,
        severity: assetHeatmapSeverity(metric, value ?? 0, snapshot.status)
      };
    });
  return { metric, filters: { groupId: filters.groupId || null, segmentId: filters.segmentId || null }, components };
}

export async function getFloorPlanServiceOrderHeatmap(planId, startDate, endDate, filters = {}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || (end - start) > 366 * 86400000) {
    throw makeHttpError(400, "Informe um período válido de até 366 dias.");
  }
  const data = await infrastructureRows(planId);
  const byAsset = new Map();
  for (const order of data.orders) {
    const created = new Date(order.created_at);
    if (created < start || created >= end) continue;
    const list = byAsset.get(order.asset_id) || [];
    list.push(order);
    byAsset.set(order.asset_id, list);
  }
  const components = filterInfrastructureObjects(data.objects, filters)
    .filter((item) => item.linked_asset_id)
    .map((item) => {
      const orders = byAsset.get(item.linked_asset_id) || [];
      const open = orders.filter((order) => !order.closed_at).length;
      const overdue = orders.filter((order) => !order.closed_at && order.sla_due_at && new Date(order.sla_due_at) < new Date()).length;
      const score = orders.length + open * 2 + overdue * 3;
      return {
        componentId: item.id,
        assetId: item.linked_asset_id,
        label: item.label,
        totalServiceOrders: orders.length,
        openServiceOrders: open,
        overdueServiceOrders: overdue,
        score,
        severity: score >= 10 ? "critical" : score >= 6 ? "high" : score >= 3 ? "medium" : "low"
      };
    });
  return {
    period: { startDate: start.toISOString(), endDate: end.toISOString() },
    filters: { groupId: filters.groupId || null, segmentId: filters.segmentId || null },
    components,
    summary: {
      totalServiceOrders: components.reduce((sum, item) => sum + item.totalServiceOrders, 0),
      openServiceOrders: components.reduce((sum, item) => sum + item.openServiceOrders, 0),
      overdueServiceOrders: components.reduce((sum, item) => sum + item.overdueServiceOrders, 0)
    }
  };
}

export async function getFloorPlanInfrastructureSummary(planId, filters = {}) {
  const data = await infrastructureRows(planId);
  const objects = filterInfrastructureObjects(data.objects, filters);
  const assetMap = new Map(data.assets.map((item) => [item.asset_id, item]));
  const linked = objects.filter((item) => item.linked_asset_id);
  const snapshots = linked.map((item) => assetSnapshot(assetMap.get(item.linked_asset_id)));
  const linkedIds = new Set(linked.map((item) => item.linked_asset_id));
  return {
    totalComponents: objects.length,
    linkedAssets: linked.length,
    onlineAssets: snapshots.filter((item) => item.status === "online").length,
    offlineAssets: snapshots.filter((item) => item.status === "offline").length,
    assetsWithoutAgent: snapshots.filter((item) => item.status === "no_agent").length,
    openServiceOrders: data.orders.filter((item) => linkedIds.has(item.asset_id) && !item.closed_at).length,
    overdueServiceOrders: data.orders.filter((item) => linkedIds.has(item.asset_id) && !item.closed_at && item.sla_due_at && new Date(item.sla_due_at) < new Date()).length,
    criticalAlerts: data.alerts.filter((item) => linkedIds.has(item.asset_id) && ["critical", "high"].includes(item.severity)).length,
    segmentsRepresented: new Set(objects.map((item) => item.segment_id).filter(Boolean)).size,
    groupsRepresented: new Set(objects.map((item) => item.group_id).filter(Boolean)).size
  };
}
