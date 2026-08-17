import {
  createPlan,
  disablePlan,
  getAgenda,
  getAssetDetail,
  getManagementOverview,
  getPlanDetail,
  getPlanHistory,
  listAllPlans,
  prepareManualRun,
  processDuePlans,
  reactivatePlan,
  removeAssetFromPlan,
  removeAssetOverrideFromPlan,
  removePlan,
  runScheduledMaintenanceCron,
  saveAssetOverrideForPlan,
  updatePlan
} from "../services/preventiveAutomationService.js";

function readCronSecretFromRequest(req) {
  const authorization = req.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return req.get("x-preventive-cron-secret") || "";
}

export async function list(req, res, next) {
  try {
    res.json({ preventiveAutomationPlans: await listAllPlans(req.user, req.query) });
  } catch (error) {
    next(error);
  }
}

export async function management(req, res, next) {
  try {
    res.json(await getManagementOverview(req.user, req.query));
  } catch (error) {
    next(error);
  }
}

export async function agenda(req, res, next) {
  try {
    res.json(await getAgenda(req.query, req.user));
  } catch (error) {
    next(error);
  }
}

export async function history(req, res, next) {
  try {
    const result = await getPlanHistory(req.params.id, req.query.limit, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const preventiveAutomationPlan = await getPlanDetail(req.params.id, req.user);
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const preventiveAutomationPlan = await createPlan(req.body, req.user);
    res.status(201).json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const preventiveAutomationPlan = await updatePlan(req.params.id, req.body, req.user);
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function disable(req, res, next) {
  try {
    const preventiveAutomationPlan = await disablePlan(req.params.id, req.user);
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function reactivate(req, res, next) {
  try {
    const preventiveAutomationPlan = await reactivatePlan(req.params.id, req.user);
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const preventiveAutomationPlan = await removePlan(req.params.id, req.user);
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function assetDetail(req, res, next) {
  try {
    const automationAsset = await getAssetDetail(req.params.id, req.params.assetId, req.user);
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function saveAssetOverride(req, res, next) {
  try {
    const automationAsset = await saveAssetOverrideForPlan(req.params.id, req.params.assetId, req.body, req.user);
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function removeAssetOverride(req, res, next) {
  try {
    const automationAsset = await removeAssetOverrideFromPlan(req.params.id, req.params.assetId, req.user);
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function removeAsset(req, res, next) {
  try {
    const result = await removeAssetFromPlan(req.params.id, req.params.assetId, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function prepare(req, res, next) {
  try {
    const result = await prepareManualRun(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function processDue(req, res, next) {
  try {
    res.json(await processDuePlans(req.user));
  } catch (error) {
    next(error);
  }
}

export async function processDueCron(req, res, next) {
  try {
    const receivedSecret = readCronSecretFromRequest(req);
    const result = await runScheduledMaintenanceCron(receivedSecret);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
