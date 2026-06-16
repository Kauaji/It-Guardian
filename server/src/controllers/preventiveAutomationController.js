import {
  createPreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  findPreventiveAutomationPlanById,
  listPreventiveAutomationPlans,
  preparePreventiveAutomationPlan,
  processDuePreventiveAutomationPlans,
  updatePreventiveAutomationPlan
} from "../repositories/preventiveAutomationRepository.js";

export async function list(req, res, next) {
  try {
    res.json({ preventiveAutomationPlans: await listPreventiveAutomationPlans() });
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const preventiveAutomationPlan = await findPreventiveAutomationPlanById(req.params.id);

    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }

    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const preventiveAutomationPlan = await createPreventiveAutomationPlan(req.body || {}, req.user);
    res.status(201).json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const preventiveAutomationPlan = await updatePreventiveAutomationPlan(req.params.id, req.body || {}, req.user);

    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }

    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function disable(req, res, next) {
  try {
    const preventiveAutomationPlan = await disablePreventiveAutomationPlan(req.params.id, req.user);

    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }

    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function prepare(req, res, next) {
  try {
    const result = await preparePreventiveAutomationPlan(req.params.id, req.user, {
      triggerType: "manual",
      scheduledFor: new Date()
    });

    if (!result) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function processDue(req, res, next) {
  try {
    res.json(await processDuePreventiveAutomationPlans(req.user));
  } catch (error) {
    next(error);
  }
}

export async function processDueCron(req, res, next) {
  try {
    const expectedSecret = process.env.PREVENTIVE_CRON_SECRET;
    if (!expectedSecret) {
      res.status(503).json({ message: "Scheduler preventivo sem segredo configurado." });
      return;
    }

    const authorization = req.get("authorization") || "";
    const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
    const headerSecret = req.get("x-preventive-cron-secret") || "";
    if (bearer !== expectedSecret && headerSecret !== expectedSecret) {
      res.status(403).json({ message: "Scheduler preventivo nao autorizado." });
      return;
    }

    res.json(await processDuePreventiveAutomationPlans({ id: null, name: "Scheduler preventivo" }));
  } catch (error) {
    next(error);
  }
}
