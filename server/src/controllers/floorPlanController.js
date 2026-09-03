import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  getFloorPlan,
  getFloorPlanAssetHeatmap,
  getFloorPlanBackground,
  getFloorPlanInfrastructureSummary,
  getFloorPlanServiceOrderHeatmap,
  linkFloorPlanObject,
  listFloorPlans,
  removeFloorPlanBackground,
  saveFloorPlanBackground,
  saveFloorPlanEditorData,
  updateFloorPlan
} from "../services/floorPlanService.js";

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

export async function uploadFloorPlanBackgroundController(req, res, next) {
  try {
    const encodedName = String(req.headers["x-file-name"] || "planta");
    let fileName = encodedName;
    try { fileName = decodeURIComponent(encodedName); } catch { /* Repository sanitizes malformed names. */ }
    const background = await saveFloorPlanBackground(
      req.params.id,
      req.params.floorId,
      req.body,
      req.headers["content-type"],
      fileName,
      req.user
    );
    res.status(201).json({ background });
  } catch (error) {
    next(error);
  }
}

export async function getFloorPlanBackgroundController(req, res, next) {
  try {
    const background = await getFloorPlanBackground(req.params.id, req.params.floorId);
    res.setHeader("Content-Type", background.mime_type);
    res.setHeader("Content-Length", background.byte_size);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("ETag", `"${background.sha256}"`);
    res.send(background.file_data);
  } catch (error) {
    next(error);
  }
}

export async function deleteFloorPlanBackgroundController(req, res, next) {
  try {
    res.json({ background: await removeFloorPlanBackground(req.params.id, req.params.floorId, req.user) });
  } catch (error) {
    next(error);
  }
}

export async function floorPlanSummaryController(req, res, next) {
  try {
    res.json({ summary: await getFloorPlanInfrastructureSummary(req.params.id, req.query) });
  } catch (error) {
    next(error);
  }
}

export async function floorPlanAssetHeatmapController(req, res, next) {
  try {
    res.json({ heatmap: await getFloorPlanAssetHeatmap(req.params.id, req.query.metric, req.query) });
  } catch (error) {
    next(error);
  }
}

export async function floorPlanServiceOrderHeatmapController(req, res, next) {
  try {
    res.json({
      heatmap: await getFloorPlanServiceOrderHeatmap(
        req.params.id,
        req.query.startDate,
        req.query.endDate,
        req.query
      )
    });
  } catch (error) {
    next(error);
  }
}
