/**
 * Ponto de entrada historico do dominio de scripts de manutencao. A
 * implementacao foi dividida por responsabilidade:
 *
 * - regras puras (analise, bloqueio de conteudo, normalizacao, recomendacao,
 *   interpretacao de log, politica de uso): domain/maintenanceScripts/*
 * - SQL e mapeamento de linhas:            repositories/maintenanceScripts/*
 * - orquestracao e transacoes:             services/maintenanceScripts/*
 *
 * Este barril reexporta a API publica que outros modulos (bootstrap, alertas,
 * preventivas, painel) e os testes ja importam; codigo novo deve importar
 * direto dos modulos acima.
 */
export {
  allowedScriptVariables,
  normalizeRiskLevel,
  riskLevels,
  scriptTypes,
  simulationModes,
  validationStatuses
} from "../domain/maintenanceScripts/scriptVocabulary.js";
export { analyzeMaintenanceScriptContent } from "../domain/maintenanceScripts/contentAnalysis.js";
export { assertScriptContentIsSafe } from "../domain/maintenanceScripts/contentSafety.js";
export {
  inferTechnicalCategory,
  recommendMaintenanceScripts,
  scoreMaintenanceScriptForContext,
  toRecommendedScriptResponse
} from "../domain/maintenanceScripts/recommendation.js";
export { listServiceOrderScriptActivity } from "./maintenanceScripts/scriptLogRepository.js";
export {
  createMaintenanceScript,
  deactivateMaintenanceScript,
  findMaintenanceScriptById,
  listMaintenanceScripts,
  seedDefaultMaintenanceScripts,
  updateMaintenanceScript
} from "../services/maintenanceScripts/scriptCatalogService.js";
export {
  acknowledgeScriptLog,
  applyScriptLogSuggestedSolution,
  createScriptSimulationLog,
  findScriptLogById,
  listPendingScriptLogs,
  listRecentScriptExecutionLogs
} from "../services/maintenanceScripts/scriptLogService.js";
export {
  registerMaintenanceScriptSimulation,
  useScriptForServiceOrder,
  useScriptFromSuggestion
} from "../services/maintenanceScripts/scriptUsageService.js";
export {
  cancelScriptValidation,
  listScriptValidationsForSuggestion,
  refreshDueScriptValidations
} from "../services/maintenanceScripts/scriptValidationService.js";
export { listRecommendedScriptsForSuggestion } from "../services/maintenanceScripts/suggestionRecommendationService.js";
