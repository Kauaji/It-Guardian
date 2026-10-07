import { getFinalStatus } from "../../domain/serviceOrders/serviceOrderSettings.js";
import { computeServiceOrderSlaDueAt, getTimedPriority } from "../../domain/serviceOrders/serviceOrderSla.js";
import { addServiceOrderAssetHistory, addServiceOrderHistory } from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { getServiceOrderSettings } from "../../repositories/serviceOrders/serviceOrderSettingsRepository.js";
import {
  listOrdersWithAutoPriority,
  listOrdersWithExpiredSla,
  markSlaBreachedRow,
  updateAutoPriorityRow
} from "../../repositories/serviceOrders/serviceOrderWriteRepository.js";

const systemUser = { name: "Sistema" };

async function persistAutoPriority(row, settings) {
  const nextPriority = getTimedPriority(row, settings);
  if (nextPriority === row.priority) return row;

  // Se a OS ja tinha um prazo de SLA calculado, recalcula com a prioridade
  // nova (mesmo inicio - created_at) - sem isso, uma OS escalada de baixa
  // pra critica manteria um prazo de 72h calculado quando ainda era baixa.
  const nextSlaDueAt = row.sla_due_at ? computeServiceOrderSlaDueAt(nextPriority, settings, row.created_at) : row.sla_due_at;

  const updated = await updateAutoPriorityRow(row.id, nextPriority, nextSlaDueAt);

  await addServiceOrderHistory({
    serviceOrderId: row.id,
    eventType: "auto_priority",
    message: "Prioridade automatica alterada por tempo.",
    oldValue: row.priority,
    newValue: nextPriority,
    user: systemUser
  });
  await addServiceOrderAssetHistory({
    assetId: row.asset_id,
    serviceOrder: row,
    eventType: "auto_priority",
    message: "Prioridade automática alterada por tempo.",
    oldValue: row.priority,
    newValue: nextPriority,
    user: systemUser
  });

  return updated || row;
}

/**
 * Persiste a prioridade automatica de todas as OS elegiveis de uma vez --
 * chamada exclusivamente pelo job diario agendado
 * (`processScheduledMaintenanceTasks`), nunca por um caminho de leitura.
 */
export async function syncAutoPriorities() {
  const settings = await getServiceOrderSettings();
  if (!settings.autoPriority.enabled) return { checked: 0, updated: 0 };

  const rows = await listOrdersWithAutoPriority(getFinalStatus(settings).id);

  let updated = 0;
  for (const row of rows) {
    const before = row.priority;
    const after = await persistAutoPriority(row, settings);
    if (after.priority !== before) updated += 1;
  }

  return { checked: rows.length, updated };
}

/**
 * Marca `sla_breached_at` uma unica vez por OS (guardado por IS NULL) --
 * mesmo padrao de `syncAutoPriorities`: so roda pelo job agendado, nunca
 * por leitura. E o unico jeito de "SLA vencido" virar um evento discreto
 * no historico/Prontuario Tecnico, em vez de recomputado a cada leitura.
 */
export async function syncSlaBreaches() {
  const settings = await getServiceOrderSettings();
  const rows = await listOrdersWithExpiredSla(getFinalStatus(settings).id);

  let breached = 0;
  for (const row of rows) {
    const updated = await markSlaBreachedRow(row.id);
    if (!updated) continue;
    breached += 1;

    await addServiceOrderHistory({
      serviceOrderId: row.id,
      eventType: "sla_breached",
      message: "SLA da ordem de servico vencido.",
      oldValue: null,
      newValue: row.sla_due_at,
      user: systemUser
    });
    await addServiceOrderAssetHistory({
      assetId: row.asset_id,
      serviceOrder: row,
      eventType: "sla_breached",
      message: "SLA vencido.",
      oldValue: null,
      newValue: row.sla_due_at,
      user: systemUser
    });
  }

  return { checked: rows.length, breached };
}
