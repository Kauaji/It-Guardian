import { timingSafeEqual } from "node:crypto";
import {
  createPreventiveAutomationPlan,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  findPreventiveAutomationAssetDetails,
  findPreventiveAutomationPlanById,
  listPreventiveAutomationAgenda,
  listPreventiveAutomationManagement,
  listPreventiveAutomationPlanHistory,
  listPreventiveAutomationPlans,
  preparePreventiveAutomationPlan,
  processDuePreventiveAutomationPlans,
  processScheduledMaintenanceTasks,
  reactivatePreventiveAutomationPlan,
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  upsertPreventiveAutomationAssetOverride,
  updatePreventiveAutomationPlan
} from "../repositories/preventiveAutomationRepository.js";

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getCronSecret() {
  return process.env.CRON_SECRET || process.env.PREVENTIVE_CRON_SECRET || "";
}

function readCronSecretFromRequest(req) {
  const authorization = req.get("authorization") || "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return req.get("x-preventive-cron-secret") || "";
}

export async function list(req, res, next) {
  try {
    res.json({ preventiveAutomationPlans: await listPreventiveAutomationPlans(req.user, req.query || {}) });
  } catch (error) {
    next(error);
  }
}

export async function management(req, res, next) {
  try {
    res.json(await listPreventiveAutomationManagement(req.user, req.query || {}));
  } catch (error) {
    next(error);
  }
}

export async function agenda(req, res, next) {
  try {
    res.json(await listPreventiveAutomationAgenda(req.query || {}, req.user));
  } catch (error) {
    next(error);
  }
}

export async function history(req, res, next) {
  try {
    const result = await listPreventiveAutomationPlanHistory(req.params.id, {
      limit: req.query.limit
    }, req.user);
    if (!result) {
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const preventiveAutomationPlan = await findPreventiveAutomationPlanById(req.params.id, req.user);

    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
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
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
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
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
      return;
    }

    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function reactivate(req, res, next) {
  try {
    const preventiveAutomationPlan = await reactivatePreventiveAutomationPlan(req.params.id, req.user);

    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
      return;
    }

    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const preventiveAutomationPlan = await deletePreventiveAutomationPlan(req.params.id, req.user);
    if (!preventiveAutomationPlan) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }
    res.json({ preventiveAutomationPlan });
  } catch (error) {
    next(error);
  }
}

export async function assetDetail(req, res, next) {
  try {
    const automationAsset = await findPreventiveAutomationAssetDetails(req.params.id, req.params.assetId, req.user);
    if (!automationAsset) {
      res.status(404).json({ message: "Vinculo de automacao da maquina nao encontrado." });
      return;
    }
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function saveAssetOverride(req, res, next) {
  try {
    const automationAsset = await upsertPreventiveAutomationAssetOverride(
      req.params.id,
      req.params.assetId,
      req.body || {},
      req.user
    );
    if (!automationAsset) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function removeAssetOverride(req, res, next) {
  try {
    const automationAsset = await removePreventiveAutomationAssetOverride(
      req.params.id,
      req.params.assetId,
      req.user
    );
    if (!automationAsset) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }
    res.json({ automationAsset });
  } catch (error) {
    next(error);
  }
}

export async function removeAsset(req, res, next) {
  try {
    const result = await removeAssetFromPreventiveAutomationPlan(
      req.params.id,
      req.params.assetId,
      req.user
    );
    if (!result) {
      res.status(404).json({ message: "Plano de automacao preventiva nao encontrado." });
      return;
    }
    res.json(result);
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
      res.status(404).json({ message: "Plano de automação preventiva não encontrado." });
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
    const expectedSecret = getCronSecret();
    if (!expectedSecret) {
      res.status(503).json({ message: "Scheduler preventivo sem segredo configurado." });
      return;
    }

    const receivedSecret = readCronSecretFromRequest(req);
    if (!receivedSecret) {
      res.status(401).json({ message: "Scheduler preventivo não autorizado." });
      return;
    }
    if (!safeEquals(receivedSecret, expectedSecret)) {
      res.status(403).json({ message: "Scheduler preventivo não autorizado." });
      return;
    }

    const startedAt = new Date();
    const result = await processScheduledMaintenanceTasks({ id: null, name: "Scheduler preventivo" });
    const finishedAt = new Date();

    res.json({
      success: true,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      preventivePlans: result.preventiveAutomation,
      scriptValidations: result.scriptValidations,
      errors: [
        ...(result.backfill?.plans || [])
          .filter((plan) => plan.status === "failed")
          .map((plan) => ({ scope: "backfill", planId: plan.planId, message: plan.message })),
        ...(result.preventiveAutomation?.plans || [])
          .filter((plan) => plan.status === "failed")
          .map((plan) => ({ scope: "preventiveAutomation", planId: plan.planId, message: plan.message })),
        ...(result.scriptValidations?.failedValidations || [])
          .map((validation) => ({ scope: "scriptValidations", validationId: validation.validationId, message: validation.message }))
      ],
      durationMs: finishedAt.getTime() - startedAt.getTime()
    });
  } catch (error) {
    next(error);
  }
}
