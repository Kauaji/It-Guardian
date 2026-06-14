import {
  createPreventivePlan,
  createServiceOrderFromPreventivePlan,
  findPreventivePlanById,
  listPreventivePlanLogs,
  listPreventivePlans,
  preparePreventivePlan
} from "../repositories/preventivePlanRepository.js";

export async function list(req, res, next) {
  try {
    res.json({ preventivePlans: await listPreventivePlans() });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const preventivePlan = await createPreventivePlan(req.body || {}, req.user);
    res.status(201).json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const preventivePlan = await findPreventivePlanById(req.params.id);
    if (!preventivePlan) {
      res.status(404).json({ message: "Plano preventivo não encontrado." });
      return;
    }
    res.json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function prepare(req, res, next) {
  try {
    const preventivePlan = await preparePreventivePlan(req.params.id, req.user);
    if (!preventivePlan) {
      res.status(404).json({ message: "Plano preventivo não encontrado." });
      return;
    }
    res.json({ preventivePlan });
  } catch (error) {
    next(error);
  }
}

export async function createServiceOrder(req, res, next) {
  try {
    const result = await createServiceOrderFromPreventivePlan(req.params.id, req.user);
    if (!result) {
      res.status(404).json({ message: "Plano preventivo não encontrado." });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logs(req, res, next) {
  try {
    const planLogs = await listPreventivePlanLogs(req.params.id);
    if (!planLogs) {
      res.status(404).json({ message: "Plano preventivo não encontrado." });
      return;
    }
    res.json({ logs: planLogs });
  } catch (error) {
    next(error);
  }
}
