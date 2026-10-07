import { formatItemsForHistory, itemsSignature, normalizeServiceOrderItems } from "../../domain/serviceOrders/serviceOrderItems.js";
import {
  buildServiceOrderChanges,
  calculateServiceOrderTotals,
  hasAssignedTechniciansPayload,
  hasItemsPayload,
  hasOwn,
  resolveAssignedTechnicianNames,
  resolveUpdateServiceValue
} from "../../domain/serviceOrders/serviceOrderPayload.js";
import { buildUpdatedServiceOrderRow, resolveClosedAt } from "../../domain/serviceOrders/serviceOrderRows.js";
import { getFinalStatus } from "../../domain/serviceOrders/serviceOrderSettings.js";
import { listServiceOrderItems, replaceServiceOrderItems } from "../../repositories/serviceOrders/serviceOrderItemRepository.js";
import {
  addServiceOrderAssetHistory,
  addServiceOrderHistory,
  listServiceOrderHistory
} from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { fromOrderRow } from "../../repositories/serviceOrders/serviceOrderMappers.js";
import { findServiceOrderById } from "../../repositories/serviceOrders/serviceOrderReadRepository.js";
import { getServiceOrderSettings } from "../../repositories/serviceOrders/serviceOrderSettingsRepository.js";
import { setAssignedTechnicianNames, updateServiceOrderRow } from "../../repositories/serviceOrders/serviceOrderWriteRepository.js";
import { resolveServiceOrderSector, resolveServiceOrderService } from "./serviceOrderResolutionService.js";

// Registra no historico da OS (e da maquina vinculada) cada campo alterado.
async function recordFieldChanges({ id, changes, updatedRow, nextAssetId, user }) {
  for (const [eventType, message, oldValue, newValue] of changes) {
    await addServiceOrderHistory({ serviceOrderId: id, eventType, message, oldValue, newValue, user });
    if (eventType !== "asset") {
      await addServiceOrderAssetHistory({
        assetId: nextAssetId,
        serviceOrder: updatedRow,
        eventType,
        message,
        oldValue,
        newValue,
        user
      });
    }
  }
}

// Trocar a maquina vinculada gera "desvinculada" na antiga e "vinculada" na nova.
async function recordAssetRelink({ payload, current, updatedRow, nextAssetId, user }) {
  if (!hasOwn(payload, "assetId") || String(current.assetId || "") === String(nextAssetId || "")) return;

  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: updatedRow,
    eventType: "unlinked",
    message: "desvinculada desta máquina.",
    oldValue: current.assetId,
    newValue: nextAssetId,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: nextAssetId,
    serviceOrder: updatedRow,
    eventType: "linked",
    message: "vinculada a esta máquina.",
    oldValue: current.assetId,
    newValue: nextAssetId,
    user
  });
}

async function recordItemsChange({ id, current, nextItems, updatedRow, nextAssetId, user }) {
  const oldValue = formatItemsForHistory(current.items || []);
  const newValue = formatItemsForHistory(nextItems);
  await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "service_order_items",
    message: `Pecas e valores registrados na OS ${current.number}.`,
    oldValue,
    newValue,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: nextAssetId,
    serviceOrder: updatedRow,
    eventType: "items",
    message: "Peças e valores atualizados.",
    oldValue,
    newValue,
    user
  });
}

export async function updateServiceOrder({ id, payload, user }) {
  const current = await findServiceOrderById(id, user);
  if (!current) return null;

  const settings = await getServiceOrderSettings();
  const nextStatus = payload.status ?? current.status;
  const closedAt = resolveClosedAt({ nextStatus, finalStatus: getFinalStatus(settings).id, current });
  const itemsInPayload = hasItemsPayload(payload);
  const nextItems = itemsInPayload
    ? normalizeServiceOrderItems(payload.items ?? payload.serviceItems ?? [])
    : normalizeServiceOrderItems(current.items || current.serviceItems || []);
  const sector = await resolveServiceOrderSector(payload, current);
  const service = await resolveServiceOrderService(payload, current);
  const serviceValue = resolveUpdateServiceValue(payload, current, service);
  const money = calculateServiceOrderTotals(serviceValue, nextItems);
  const itemsChanged = itemsInPayload && itemsSignature(current.items || []) !== itemsSignature(nextItems);
  const assignedTechnicianNames = resolveAssignedTechnicianNames(payload, current);

  const row = buildUpdatedServiceOrderRow({
    payload,
    current,
    nextStatus,
    closedAt,
    sector,
    service,
    money,
    assignedTechnicianNames
  });
  let updatedRow = await updateServiceOrderRow(id, row);

  if (itemsInPayload) {
    await replaceServiceOrderItems(id, nextItems);
  }

  if (hasAssignedTechniciansPayload(payload)) {
    updatedRow = (await setAssignedTechnicianNames(id, assignedTechnicianNames)) || updatedRow;
  }
  const nextAssetId = updatedRow.asset_id || null;

  const changes = buildServiceOrderChanges({
    current,
    payload,
    assignedTechnicianNames,
    nextAssetId,
    serviceValue,
    sector,
    service,
    itemsInPayload
  });
  await recordFieldChanges({ id, changes, updatedRow, nextAssetId, user });
  await recordAssetRelink({ payload, current, updatedRow, nextAssetId, user });
  if (itemsChanged) {
    await recordItemsChange({ id, current, nextItems, updatedRow, nextAssetId, user });
  }

  return fromOrderRow(updatedRow, await listServiceOrderHistory(id), await listServiceOrderItems(id), settings);
}
