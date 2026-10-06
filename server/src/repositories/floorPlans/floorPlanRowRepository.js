import { query } from "../../database.js";
import { makeHttpError } from "../../domain/floorPlans/floorPlanErrors.js";
import { nullableText } from "../../domain/floorPlans/floorPlanPayload.js";
import { mapCableRoute, mapConnectionPoint, mapFloor, mapObject, mapPlan, mapZone } from "./floorPlanMappers.js";

export async function getPlanRowOrThrow(id, db = query) {
  const result = await db("SELECT * FROM floor_plans WHERE id = $1", [id]);
  const row = result.rows[0];
  if (!row) throw makeHttpError(404, "Planta nao encontrada.");
  return row;
}

export async function loadBundle(planId, db = query) {
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

export async function insertFloor(db, planId, floor) {
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

export async function insertZone(db, zone) {
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

export async function insertObject(db, object) {
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

export async function insertConnectionPoint(db, point) {
  await db(
    `
      INSERT INTO floor_plan_connection_points (
        id, plan_id, floor_id, point_type, label, linked_object_id, x, y, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      point.id,
      point.planId,
      point.floorId,
      point.pointType,
      point.label,
      point.linkedObjectId,
      point.x,
      point.y,
      JSON.stringify(point.metadata)
    ]
  );
}

export async function insertCableRoute(db, route) {
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

export async function planExistsForInventoryTab(db, inventoryTabId) {
  const result = await db("SELECT id FROM floor_plans WHERE inventory_tab_id = $1 LIMIT 1", [inventoryTabId]);
  return result.rows.length > 0;
}

export async function insertPlanRow(db, { id, plan, activeFloorId, userId }) {
  await db(
    `
      INSERT INTO floor_plans (
        id, inventory_tab_id, name, company, unit, floor_label, status, width, height, grid_size, snap_size,
        active_floor_id, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
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
      userId
    ]
  );
}

export async function updatePlanRow(db, { id, plan, activeFloorId, userId }) {
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
      userId
    ]
  );
}

export async function insertDuplicatedPlanRow(db, { id, name, sourcePlan, activeFloorId, userId }) {
  await db(
    `
      INSERT INTO floor_plans (
        id, name, company, unit, floor_label, status, width, height, grid_size, snap_size,
        active_floor_id, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $11)
    `,
    [
      id,
      name,
      sourcePlan.company,
      sourcePlan.unit,
      sourcePlan.floorLabel,
      sourcePlan.width,
      sourcePlan.height,
      sourcePlan.gridSize,
      sourcePlan.snapSize,
      activeFloorId,
      userId
    ]
  );
}

export async function deletePlanRow(db, id) {
  await db("DELETE FROM floor_plans WHERE id = $1", [id]);
}

/**
 * Substitui andares, zonas, objetos, pontos e rotas da planta pelos dados ja
 * normalizados, preservando os fundos dos andares que continuam existindo.
 */
export async function replaceEditorChildren(db, planId, { floors, zones, objects, connectionPoints, cableRoutes }) {
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
}

export async function findObjectRow(db, objectId) {
  const result = await db("SELECT * FROM floor_plan_objects WHERE id = $1", [objectId]);
  return result.rows[0] || null;
}

export async function updateObjectLinkRow(db, { objectId, assetId, groupId, segmentId, label }) {
  const result = await db(
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
    [objectId, assetId, groupId, segmentId, label]
  );
  return mapObject(result.rows[0]);
}
