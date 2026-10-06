import { describeStatusChange, planServiceOrderReopen } from "../../domain/serviceOrders/serviceOrderLifecycle.js";
import { getFinalStatus } from "../../domain/serviceOrders/serviceOrderSettings.js";
import { listServiceOrderItems } from "../../repositories/serviceOrders/serviceOrderItemRepository.js";
import {
  addServiceOrderAssetHistory,
  addServiceOrderHistory,
  listServiceOrderHistory
} from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { fromOrderRow } from "../../repositories/serviceOrders/serviceOrderMappers.js";
import { findServiceOrderById } from "../../repositories/serviceOrders/serviceOrderReadRepository.js";
import { getServiceOrderSettings } from "../../repositories/serviceOrders/serviceOrderSettingsRepository.js";
import {
  deleteServiceOrderRow,
  reopenServiceOrderRow,
  updateServiceOrderStatusRow
} from "../../repositories/serviceOrders/serviceOrderWriteRepository.js";

export async function updateServiceOrderStatus({ id, status, user }) {
  const current = await findServiceOrderById(id, user);
  if (!current) return null;
  const settings = await getServiceOrderSettings();
  const finalStatus = getFinalStatus(settings).id;
  const change = describeStatusChange(status, settings);

  const updatedRow = await updateServiceOrderStatusRow(id, status, finalStatus);

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: change.eventType,
    message: change.message,
    oldValue: current.status,
    newValue: status,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: updatedRow,
    eventType: change.eventType,
    message: change.assetMessage,
    oldValue: current.status,
    newValue: status,
    user
  });

  return fromOrderRow(updatedRow, await listServiceOrderHistory(id), await listServiceOrderItems(id), settings);
}

export async function deleteServiceOrder(id, user = null) {
  const current = await findServiceOrderById(id);
  if (!current) return null;

  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "deleted",
    message: "excluída do sistema.",
    oldValue: current.status,
    user
  });
  await deleteServiceOrderRow(id);
  return current;
}

// Reabertura tem dois caminhos: o dropdown de status generico ja tratava
// implicitamente "voltar pro status inicial" como reopened (sem exigir
// motivo, comportamento existente preservado). Esta funcao e o caminho
// dedicado e mais forte: exige motivo, incrementa reopen_count e reinicia
// o prazo de SLA a partir de agora (nova janela de atendimento).
export async function reopenServiceOrder({ id, reason, user }) {
  const settings = await getServiceOrderSettings();
  const current = await findServiceOrderById(id);
  if (!current) return null;

  const plan = planServiceOrderReopen({ current, settings, reason });
  const updatedRow = await reopenServiceOrderRow({
    id,
    initialStatusId: plan.initialStatusId,
    userId: user?.id || null,
    reason: plan.reason,
    nextSlaDueAt: plan.nextSlaDueAt
  });

  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "reopened",
    message: `OS reaberta. Motivo: ${plan.reason}`,
    oldValue: current.status,
    newValue: plan.initialStatusId,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: updatedRow,
    eventType: "reopened",
    message: `reaberta. Motivo: ${plan.reason}`,
    oldValue: current.status,
    newValue: plan.initialStatusId,
    user
  });

  return fromOrderRow(updatedRow, await listServiceOrderHistory(id), await listServiceOrderItems(id), settings);
}
