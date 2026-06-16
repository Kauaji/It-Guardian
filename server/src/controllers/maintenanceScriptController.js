import {
  analyzeMaintenanceScriptContent,
  acknowledgeScriptLog,
  applyScriptLogSuggestedSolution,
  cancelScriptValidation,
  createMaintenanceScript,
  deactivateMaintenanceScript,
  findScriptLogById,
  listMaintenanceScripts,
  listPendingScriptLogs,
  listRecommendedScriptsForContext,
  listRecommendedScriptsForSuggestion,
  listScriptValidationsForSuggestion,
  registerMaintenanceScriptSimulation,
  updateMaintenanceScript,
  useScriptFromSuggestion
} from "../repositories/maintenanceScriptRepository.js";

export async function list(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive !== "false";
    res.json({ scripts: await listMaintenanceScripts({ includeInactive }) });
  } catch (error) {
    next(error);
  }
}

export async function analyze(req, res, next) {
  try {
    res.json({ analysis: analyzeMaintenanceScriptContent(req.body?.content || "") });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const script = await createMaintenanceScript(req.body || {}, req.user);
    res.status(201).json({ script });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const script = await updateMaintenanceScript(req.params.id, req.body || {});

    if (!script) {
      return res.status(404).json({ message: "Script de manutenção não encontrado." });
    }

    return res.json({ script });
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const script = await deactivateMaintenanceScript(req.params.id);

    if (!script) {
      return res.status(404).json({ message: "Script de manutenção não encontrado." });
    }

    return res.json({ script });
  } catch (error) {
    return next(error);
  }
}

export async function registerSimulation(req, res, next) {
  try {
    const result = await registerMaintenanceScriptSimulation({
      scriptId: req.params.id,
      payload: req.body || {},
      user: req.user
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function useFromSuggestion(req, res, next) {
  try {
    const result = await useScriptFromSuggestion({
      suggestionId: req.params.id,
      scriptId: req.params.scriptId,
      payload: req.body || {},
      user: req.user
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function suggestionValidations(req, res, next) {
  try {
    res.json({ validations: await listScriptValidationsForSuggestion(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function suggestionRecommendedScripts(req, res, next) {
  try {
    res.json(await listRecommendedScriptsForSuggestion(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function recommendedScriptsForContext(req, res, next) {
  try {
    res.json(await listRecommendedScriptsForContext(req.body || {}));
  } catch (error) {
    next(error);
  }
}

export async function cancelValidation(req, res, next) {
  try {
    res.json({ validation: await cancelScriptValidation(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
}

export async function pendingLogs(_req, res, next) {
  try {
    res.json({ logs: await listPendingScriptLogs() });
  } catch (error) {
    next(error);
  }
}

export async function getLog(req, res, next) {
  try {
    const log = await findScriptLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: "Log de script não encontrado." });
    }
    return res.json({ log });
  } catch (error) {
    return next(error);
  }
}

export async function acknowledgeLog(req, res, next) {
  try {
    res.json({ log: await acknowledgeScriptLog(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
}

export async function applySuggestedSolution(req, res, next) {
  try {
    res.json({
      log: await applyScriptLogSuggestedSolution(req.params.id, req.body || {}, req.user)
    });
  } catch (error) {
    next(error);
  }
}
