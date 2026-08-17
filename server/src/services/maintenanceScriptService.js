import { notFoundError } from "../lib/errors.js";
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
  listRecommendedScriptsForSuggestion,
  listScriptValidationsForSuggestion,
  registerMaintenanceScriptSimulation,
  updateMaintenanceScript,
  useScriptFromSuggestion
} from "../repositories/maintenanceScriptRepository.js";
import { listRecommendedScriptsForContext } from "./maintenanceScriptRecommendationService.js";

export async function listAllMaintenanceScripts(includeInactive) {
  return listMaintenanceScripts({ includeInactive });
}

export function analyzeScriptContent(content) {
  return analyzeMaintenanceScriptContent(content || "");
}

export async function createScript(payload, user) {
  return createMaintenanceScript(payload || {}, user);
}

export async function updateScript(id, payload, user) {
  const script = await updateMaintenanceScript(id, payload || {}, user);
  if (!script) throw notFoundError("Script de manutenção não encontrado.");
  return script;
}

export async function deactivateScript(id) {
  const script = await deactivateMaintenanceScript(id);
  if (!script) throw notFoundError("Script de manutenção não encontrado.");
  return script;
}

export async function registerSimulationForScript(scriptId, payload, user) {
  return registerMaintenanceScriptSimulation({ scriptId, payload: payload || {}, user });
}

export async function useScriptForSuggestion(suggestionId, scriptId, payload, user) {
  return useScriptFromSuggestion({ suggestionId, scriptId, payload: payload || {}, user });
}

export async function listValidationsForSuggestion(suggestionId) {
  return listScriptValidationsForSuggestion(suggestionId);
}

export async function listRecommendedForSuggestion(suggestionId) {
  return listRecommendedScriptsForSuggestion(suggestionId);
}

export async function listRecommendedForContext(context) {
  return listRecommendedScriptsForContext(context || {});
}

export async function cancelValidationById(id, user) {
  return cancelScriptValidation(id, user);
}

export async function listPendingLogs() {
  return listPendingScriptLogs();
}

export async function getLogById(id) {
  const log = await findScriptLogById(id);
  if (!log) throw notFoundError("Log de script não encontrado.");
  return log;
}

export async function acknowledgeLogById(id, user) {
  return acknowledgeScriptLog(id, user);
}

export async function applySuggestedSolutionToLog(id, payload, user) {
  return applyScriptLogSuggestedSolution(id, payload || {}, user);
}
