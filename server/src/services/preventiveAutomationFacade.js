/**
 * Fachada do dominio de automacao preventiva (camada de servicos).
 *
 * O codigo que vivia aqui foi dividido por responsabilidade:
 * - `domain/preventiveAutomation*.js`: regras puras (payload, agenda, visoes);
 * - `repositories/preventiveAutomation*Repository.js`: SQL e mapeamento;
 * - `services/preventiveAutomation*Service.js`: orquestracao e transacoes.
 *
 * Este arquivo reexporta a API publica (`bootstrap.js`, testes). Codigo novo deve
 * importar direto dos modulos acima.
 */
export {
  computeNextScheduledFor,
  defaultIntervalForType,
  normalizePreventiveSchedule,
  normalizeRecurrenceIntervalDays,
  normalizeRecurrenceType,
  recurrenceIntervalDefaults,
  recurrenceToDays
} from "../domain/preventiveSchedule.js";
export { normalizeAssetIds } from "../domain/preventiveAutomationNormalizers.js";
export {
  buildRunIdempotencyKey,
  getAssetScheduleSyncActions,
  hasPreventiveScheduleChanged,
  isScheduleLinkedToPlan,
  resolveAssetListDevices,
  resolveEffectiveRecurrence
} from "../domain/preventiveAutomationSchedule.js";
export {
  findPreventiveAutomationPlanById,
  findPreventiveAutomationPlanByPreventivePlanId,
  listDuePreventiveAutomationPlans,
  listPreventiveAutomationPlans
} from "./preventiveAutomationPlanQueryService.js";
export {
  createPreventiveAutomationPlan,
  createPreventiveAutomationPlanRecord,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  reactivatePreventiveAutomationPlan,
  updatePreventiveAutomationPlan
} from "./preventiveAutomationPlanService.js";
export {
  findPreventiveAutomationAssetDetails,
  listPreventiveAutomationAgenda,
  listPreventiveAutomationManagement,
  listPreventiveAutomationPlanHistory
} from "./preventiveAutomationManagementService.js";
export {
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  upsertPreventiveAutomationAssetOverride
} from "./preventiveAutomationAssetService.js";
export { backfillPreventiveAutomationAssetSchedules } from "./preventiveAutomationBackfillService.js";
export {
  preparePreventiveAutomationPlan,
  processDuePreventiveAutomationPlans,
  processScheduledMaintenanceTasks
} from "./preventiveAutomationRunService.js";
