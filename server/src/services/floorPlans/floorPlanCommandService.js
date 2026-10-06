import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { makeHttpError } from "../../domain/floorPlans/floorPlanErrors.js";
import {
  getUserId,
  normalizeEditorChildren,
  normalizeEditorData,
  normalizePlanPayload,
  nullableText,
  planFloorPlanDuplicate,
  resolveActiveFloorId
} from "../../domain/floorPlans/floorPlanPayload.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import { mapPlan } from "../../repositories/floorPlans/floorPlanMappers.js";
import {
  deletePlanRow,
  findObjectRow,
  getPlanRowOrThrow,
  insertCableRoute,
  insertConnectionPoint,
  insertDuplicatedPlanRow,
  insertFloor,
  insertObject,
  insertPlanRow,
  insertZone,
  loadBundle,
  planExistsForInventoryTab,
  replaceEditorChildren,
  updateObjectLinkRow,
  updatePlanRow
} from "../../repositories/floorPlans/floorPlanRowRepository.js";

export async function getFloorPlan(id) {
  return loadBundle(id);
}

export async function createFloorPlan(payload = {}, user = {}) {
  const planId = randomUUID();
  const plan = normalizePlanPayload(payload.plan || payload);
  const editorData = normalizeEditorData(payload, plan);
  const activeFloorId = resolveActiveFloorId(plan, editorData.floors);

  return withTransaction(async (db) => {
    if (plan.inventoryTabId && (await planExistsForInventoryTab(db, plan.inventoryTabId))) {
      throw makeHttpError(409, "Esta aba ja possui uma planta cadastrada.");
    }
    await insertPlanRow(db, { id: planId, plan, activeFloorId, userId: getUserId(user) });

    await replaceEditorChildren(db, planId, normalizeEditorChildren(planId, editorData));
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
    await updatePlanRow(db, { id, plan, activeFloorId: plan.activeFloorId, userId: getUserId(user) });
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
    const activeFloorId = resolveActiveFloorId(plan, editorData.floors);

    await updatePlanRow(db, { id, plan, activeFloorId, userId: getUserId(user) });
    await replaceEditorChildren(db, id, normalizeEditorChildren(id, editorData));
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
    const copy = planFloorPlanDuplicate(source, newPlanId);

    await insertDuplicatedPlanRow(db, {
      id: newPlanId,
      name: copy.name,
      sourcePlan: source.plan,
      activeFloorId: copy.activeFloorId,
      userId: getUserId(user)
    });

    for (const floor of copy.floors) await insertFloor(db, newPlanId, floor);
    for (const zone of copy.zones) await insertZone(db, zone);
    for (const object of copy.objects) await insertObject(db, object);
    for (const point of copy.connectionPoints) await insertConnectionPoint(db, point);
    for (const route of copy.cableRoutes) await insertCableRoute(db, route);

    await addLog({
      type: "floor_plan.duplicated",
      message: `Planta ${source.plan.name} duplicada.`,
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
    await deletePlanRow(db, id);
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
    const current = await findObjectRow(db, objectId);
    if (!current) throw makeHttpError(404, "Objeto da planta nao encontrado.");

    const updated = await updateObjectLinkRow(db, {
      objectId,
      assetId,
      groupId: nullableText(payload.groupId),
      segmentId: nullableText(payload.segmentId),
      label: nullableText(payload.label)
    });

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
