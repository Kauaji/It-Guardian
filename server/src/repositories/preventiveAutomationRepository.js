/**
 * Barril de compatibilidade do dominio de automacao preventiva.
 *
 * O codigo que vivia aqui foi dividido por responsabilidade:
 * - `domain/preventiveAutomation*.js`: regras puras (payload, agenda, visoes);
 * - `repositories/preventiveAutomation*Repository.js`: SQL e mapeamento;
 * - `services/preventiveAutomation*Service.js`: orquestracao e transacoes.
 *
 * Este arquivo apenas reexporta a API publica anterior para quem ainda importa
 * o caminho antigo (`bootstrap.js`, testes). Codigo novo deve importar direto
 * dos modulos acima.
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
} from "../services/preventiveAutomationPlanQueryService.js";
export {
  createPreventiveAutomationPlan,
  createPreventiveAutomationPlanRecord,
  deletePreventiveAutomationPlan,
  disablePreventiveAutomationPlan,
  reactivatePreventiveAutomationPlan,
  updatePreventiveAutomationPlan
} from "../services/preventiveAutomationPlanService.js";
export {
  findPreventiveAutomationAssetDetails,
  listPreventiveAutomationAgenda,
  listPreventiveAutomationManagement,
  listPreventiveAutomationPlanHistory
} from "../services/preventiveAutomationManagementService.js";
export {
  removeAssetFromPreventiveAutomationPlan,
  removePreventiveAutomationAssetOverride,
  upsertPreventiveAutomationAssetOverride
} from "../services/preventiveAutomationAssetService.js";
export { backfillPreventiveAutomationAssetSchedules } from "../services/preventiveAutomationBackfillService.js";
export {
  preparePreventiveAutomationPlan,
  processDuePreventiveAutomationPlans,
  processScheduledMaintenanceTasks
} from "../services/preventiveAutomationRunService.js";
