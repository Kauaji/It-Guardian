import { activeProblemTypesFromRecords, findProblemTypeKey } from "../domain/problemTypes.js";
import { listSettingsRecords } from "../repositories/settingsRepository.js";

export async function getActiveProblemTypes() {
  return activeProblemTypesFromRecords(await listSettingsRecords("problemTypes"));
}

// Reaproveitada pelo checklist tecnico (serviceOrderChecklistService.js) e
// pelo calculo de prioridade do formulario publico para resolver
// `service_orders.problem_type` (texto livre - pode ser o id de um
// problem_types configurado, o nome, ou um slug default-* quando nao ha
// nenhum problem type configurado) na mesma chave - evita as duas logicas
// de match divergirem.
export async function resolveProblemTypeKey(problemTypeValue) {
  return findProblemTypeKey(await getActiveProblemTypes(), problemTypeValue);
}
