import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  getFloorPlan,
  linkFloorPlanObject,
  listFloorPlans,
  saveFloorPlanEditorData,
  updateFloorPlan
} from "../repositories/floorPlanRepository.js";

export async function listFloorPlanController(req, res, next) {
  try {
    const plans = await listFloorPlans(req.query.inventoryTabId);
    res.json({ plans });
  } catch (error) {
    next(error);
  }
}

export async function getFloorPlanController(req, res, next) {
  try {
    const plan = await getFloorPlan(req.params.id);
    res.json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function createFloorPlanController(req, res, next) {
  try {
    const plan = await createFloorPlan(req.body, req.user);
    res.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function updateFloorPlanController(req, res, next) {
  try {
    const plan = await updateFloorPlan(req.params.id, req.body, req.user);
    res.json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function saveFloorPlanEditorDataController(req, res, next) {
  try {
    const plan = await saveFloorPlanEditorData(req.params.id, req.body, req.user);
    res.json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function duplicateFloorPlanController(req, res, next) {
  try {
    const plan = await duplicateFloorPlan(req.params.id, req.user);
    res.status(201).json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function deleteFloorPlanController(req, res, next) {
  try {
    const plan = await deleteFloorPlan(req.params.id, req.user);
    res.json({ plan });
  } catch (error) {
    next(error);
  }
}

export async function linkFloorPlanObjectController(req, res, next) {
  try {
    const object = await linkFloorPlanObject(req.params.objectId, req.body, req.user);
    res.json({ object });
  } catch (error) {
    next(error);
  }
}
