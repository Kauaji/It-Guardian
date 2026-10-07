/**
 * Fachada do dominio de scripts de manutencao (camada de servicos). A
 * implementacao foi dividida por responsabilidade:
 *
 * - regras puras (analise, bloqueio de conteudo, normalizacao, recomendacao,
 *   interpretacao de log, politica de uso): domain/maintenanceScripts/*
 * - SQL e mapeamento de linhas:            repositories/maintenanceScripts/*
 * - orquestracao e transacoes:             services/maintenanceScripts/*
 *
 * Esta fachada reexporta a API publica que outros modulos (bootstrap, alertas,
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
} from "../../domain/maintenanceScripts/scriptVocabulary.js";
export { analyzeMaintenanceScriptContent } from "../../domain/maintenanceScripts/contentAnalysis.js";
export { assertScriptContentIsSafe } from "../../domain/maintenanceScripts/contentSafety.js";
export {
  inferTechnicalCategory,
  recommendMaintenanceScripts,
  scoreMaintenanceScriptForContext,
  toRecommendedScriptResponse
} from "../../domain/maintenanceScripts/recommendation.js";
export { listServiceOrderScriptActivity } from "../../repositories/maintenanceScripts/scriptLogRepository.js";
export {
  createMaintenanceScript,
  deactivateMaintenanceScript,
  findMaintenanceScriptById,
  listMaintenanceScripts,
  seedDefaultMaintenanceScripts,
  updateMaintenanceScript
} from "./scriptCatalogService.js";
export {
  acknowledgeScriptLog,
  applyScriptLogSuggestedSolution,
  createScriptSimulationLog,
  findScriptLogById,
  listPendingScriptLogs,
  listRecentScriptExecutionLogs
} from "./scriptLogService.js";
export { registerMaintenanceScriptSimulation } from "./scriptSimulationService.js";
export { useScriptFromSuggestion } from "./suggestionScriptUsageService.js";
export { useScriptForServiceOrder } from "./serviceOrderScriptUsageService.js";
export { cancelScriptValidation, listScriptValidationsForSuggestion, refreshDueScriptValidations } from "./scriptValidationService.js";
export { listRecommendedScriptsForSuggestion } from "./suggestionRecommendationService.js";
