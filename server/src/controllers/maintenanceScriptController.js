import {
  acknowledgeLogById,
  analyzeScriptContent,
  applySuggestedSolutionToLog,
  cancelValidationById,
  createScript,
  deactivateScript,
  getLogById,
  listAllMaintenanceScripts,
  listPendingLogs,
  listRecommendedForContext,
  listRecommendedForSuggestion,
  listScriptActivityForServiceOrder,
  listValidationsForSuggestion,
  registerSimulationForScript,
  updateScript,
  useScriptForServiceOrderEntry,
  useScriptForSuggestion
} from "../services/maintenanceScriptService.js";

export async function list(req, res, next) {
  try {
    const includeInactive = req.query.includeInactive !== "false";
    res.json({ scripts: await listAllMaintenanceScripts(includeInactive) });
  } catch (error) {
    next(error);
  }
}

export async function analyze(req, res, next) {
  try {
    res.json({ analysis: analyzeScriptContent(req.body?.content) });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const script = await createScript(req.body, req.user);
    res.status(201).json({ script });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const script = await updateScript(req.params.id, req.body, req.user);
    res.json({ script });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const script = await deactivateScript(req.params.id);
    res.json({ script });
  } catch (error) {
    next(error);
  }
}

export async function registerSimulation(req, res, next) {
  try {
    const result = await registerSimulationForScript(req.params.id, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function useFromSuggestion(req, res, next) {
  try {
    const result = await useScriptForSuggestion(req.params.id, req.params.scriptId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function useForServiceOrder(req, res, next) {
  try {
    const result = await useScriptForServiceOrderEntry(req.params.id, req.params.scriptId, req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function serviceOrderScriptActivity(req, res, next) {
  try {
    res.json({ activity: await listScriptActivityForServiceOrder(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function suggestionValidations(req, res, next) {
  try {
    res.json({ validations: await listValidationsForSuggestion(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function suggestionRecommendedScripts(req, res, next) {
  try {
    res.json(await listRecommendedForSuggestion(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function recommendedScriptsForContext(req, res, next) {
  try {
    res.json(await listRecommendedForContext(req.body));
  } catch (error) {
    next(error);
  }
}

export async function cancelValidation(req, res, next) {
  try {
    res.json({ validation: await cancelValidationById(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
}

export async function pendingLogs(_req, res, next) {
  try {
    res.json({ logs: await listPendingLogs() });
  } catch (error) {
    next(error);
  }
}

export async function getLog(req, res, next) {
  try {
    const log = await getLogById(req.params.id);
    res.json({ log });
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeLog(req, res, next) {
  try {
    res.json({ log: await acknowledgeLogById(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
}

export async function applySuggestedSolution(req, res, next) {
  try {
    res.json({ log: await applySuggestedSolutionToLog(req.params.id, req.body, req.user) });
  } catch (error) {
    next(error);
  }
}
