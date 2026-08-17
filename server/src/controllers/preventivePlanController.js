import {
  createPlan,
  createServiceOrderFromPlan,
  getPlanLogs,
  getPreventivePlanDetail,
  listAllPreventivePlans,
  prepareExistingPlan
} from "../services/preventivePlanService.js";

export async function list(req, res, next) {
  try {
    res.json({ preventivePlans: await listAllPreventivePlans() });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const preventivePlan = await createPlan(req.body, req.user);
    res.status(201).json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const preventivePlan = await getPreventivePlanDetail(req.params.id);
    res.json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function prepare(req, res, next) {
  try {
    const preventivePlan = await prepareExistingPlan(req.params.id, req.user);
    res.json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function createServiceOrder(req, res, next) {
  try {
    const result = await createServiceOrderFromPlan(req.params.id, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logs(req, res, next) {
  try {
    const planLogs = await getPlanLogs(req.params.id);
    res.json({ logs: planLogs });
  } catch (error) {
    next(error);
  }
}
