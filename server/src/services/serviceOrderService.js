import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { hasPermission } from "../permissions.js";
import { badRequest, conflict, forbidden, notFoundError } from "../lib/errors.js";
import {
  finishMaintenanceForAsset,
  releaseBackupFromServiceOrder,
  startMaintenanceForAsset
} from "../repositories/assetLifecycleRepository.js";
import {
  addServiceOrderHistory,
  createServiceOrder,
  deleteServiceOrder,
  findServiceOrderById,
  getFinalStatus,
  getInitialStatus,
  getServiceOrderSettings,
  hasServiceOrderStatus,
  listServiceOrders,
  maxServiceOrderStatuses,
  serviceOrderPriorities,
  updateServiceOrder,
  updateServiceOrderSettings,
  updateServiceOrderStatus
} from "../repositories/serviceOrderRepository.js";

const notFoundMessage = "Ordem de servico nao encontrada.";

function validateCreatePayload(payload) {
  const title = payload.title?.trim();

  if (!title || title.length < 3) {
    throw badRequest("O titulo da ordem de servico deve ter pelo menos 3 caracteres.");
  }

  if (payload.priority && !serviceOrderPriorities.has(payload.priority)) {
    throw badRequest("Prioridade de OS invalida.");
  }
}

function validateStatus(status, settings) {
  if (!status || !hasServiceOrderStatus(settings, status)) {
    throw badRequest("Status de OS invalido.");
  }
}

async function startLinkedMaintenance(serviceOrder, user) {
  if (!serviceOrder?.assetId) return null;

  try {
    return await startMaintenanceForAsset({
      assetId: serviceOrder.assetId,
      serviceOrderId: serviceOrder.id,
      notes: `Manutencao iniciada pela OS ${serviceOrder.number}.`,
      user
    });
  } catch (error) {
    if (error.statusCode === 409) return null;
    throw error;
  }
}

async function syncServiceOrderMaintenance({ previous = null, serviceOrder, user, settings = null }) {
  if (!serviceOrder) return;

  if (previous?.assetId && previous.assetId !== serviceOrder.assetId) {
    await finishMaintenanceForAsset({
      serviceOrderId: serviceOrder.id,
      notes: "Maquina desvinculada ou substituida na OS.",
      user,
      allowMissing: true
    });
  }

  const resolvedSettings = settings || await getServiceOrderSettings();
  const isFinal = serviceOrder.status === getFinalStatus(resolvedSettings).id;
  if (isFinal) {
    await releaseBackupFromServiceOrder({ serviceOrderId: serviceOrder.id, user, allowMissing: true });
    await finishMaintenanceForAsset({
      serviceOrderId: serviceOrder.id,
      notes: "Manutencao encerrada com a finalizacao da OS.",
      user,
      allowMissing: true
    });
    return;
  }

  await startLinkedMaintenance(serviceOrder, user);
}

export async function listAllServiceOrders(user) {
  return listServiceOrders(user);
}

export async function getServiceOrderDetails(id, user) {
  const serviceOrder = await findServiceOrderById(id, user);
  if (!serviceOrder) throw notFoundError(notFoundMessage);
  return serviceOrder;
}

export async function getSettings() {
  return getServiceOrderSettings();
}

export async function updateSettingsRecord(payload, user) {
  if (Array.isArray(payload?.statuses) && payload.statuses.length > maxServiceOrderStatuses) {
    throw badRequest("Limite maximo de 10 status atingido.");
  }

  const settings = await updateServiceOrderSettings(payload || {});
  await addLog({
    type: "service_order_settings",
    message: "Service order settings updated",
    userId: user.id,
    meta: {}
  });
  return settings;
}

export async function createNewServiceOrder(payload, user) {
  validateCreatePayload(payload);

  const serviceOrder = await createServiceOrder({ payload, user });
  await syncServiceOrderMaintenance({ serviceOrder, user });
  await addLog({
    type: "service_order_create",
    message: `Service order created: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id }
  });

  return serviceOrder;
}

export async function updateExistingServiceOrder(id, payload, user) {
  const previous = await findServiceOrderById(id, user);
  if (!previous) throw notFoundError(notFoundMessage);

  const hasSectorPayload =
    Object.prototype.hasOwnProperty.call(payload || {}, "sectorId") ||
    Object.prototype.hasOwnProperty.call(payload || {}, "sectorName");

  if (hasSectorPayload && !hasPermission(user, "service_orders.change_sector")) {
    throw forbidden("Voce nao possui permissao para alterar o setor da OS.");
  }

  if (payload.priority && !serviceOrderPriorities.has(payload.priority)) {
    throw badRequest("Prioridade de OS invalida.");
  }

  if (payload.status) {
    const settings = await getServiceOrderSettings();
    validateStatus(payload.status, settings);
    if (payload.status === getFinalStatus(settings).id && !hasPermission(user, "service_orders.finish")) {
      throw forbidden("Voce nao possui permissao para finalizar esta Ordem de Servico.");
    }
  }

  const serviceOrder = await updateServiceOrder({ id, payload, user });
  if (!serviceOrder) throw notFoundError(notFoundMessage);
  await syncServiceOrderMaintenance({ previous, serviceOrder, user });

  await addLog({
    type: "service_order_update",
    message: `Service order updated: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id }
  });

  return serviceOrder;
}

export async function changeServiceOrderPriority(id, priority, user) {
  if (!serviceOrderPriorities.has(priority)) {
    throw badRequest("Prioridade de OS invalida.");
  }

  const serviceOrder = await updateServiceOrder({ id, payload: { priority }, user });
  if (!serviceOrder) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_priority",
    message: `Service order priority changed: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, priority }
  });

  return serviceOrder;
}

export async function assignServiceOrderTechnician(id, payload, user) {
  const assignedTechnicianName = String(
    payload?.assignedTechnicianName ?? payload?.technicianName ?? payload?.name ?? ""
  ).trim();

  const serviceOrder = await updateServiceOrder({
    id,
    payload: { assignedTechnicianName: assignedTechnicianName || null },
    user
  });
  if (!serviceOrder) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_technician",
    message: `Service order technician changed: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, assignedTechnicianName: assignedTechnicianName || null }
  });

  return serviceOrder;
}

export async function linkServiceOrderAsset(id, body, user) {
  const previous = await findServiceOrderById(id, user);
  if (!previous) throw notFoundError(notFoundMessage);

  const payload = {
    assetId: body?.assetId ?? body?.asset_id ?? null,
    environmentId: body?.environmentId ?? body?.environment_id,
    environmentName: body?.environmentName ?? body?.environment_name,
    relatedAssetText: body?.relatedAssetText ?? body?.related_asset_text,
    machineScope: body?.machineScope ?? body?.machine_scope,
    location: body?.location
  };

  const serviceOrder = await updateServiceOrder({ id, payload, user });
  if (!serviceOrder) throw notFoundError(notFoundMessage);
  await syncServiceOrderMaintenance({ previous, serviceOrder, user });

  await addLog({
    type: "service_order_asset",
    message: `Service order asset changed: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, assetId: payload.assetId }
  });

  return serviceOrder;
}

export async function replaceServiceOrderItems(id, body, user) {
  const items = Array.isArray(body) ? body : body?.items ?? body?.serviceItems ?? [];
  const serviceOrder = await updateServiceOrder({ id, payload: { items }, user });
  if (!serviceOrder) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_items",
    message: `Service order items changed: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, itemsCount: Array.isArray(items) ? items.length : 0 }
  });

  return serviceOrder;
}

export async function changeServiceOrderStatus(id, status, user) {
  const settings = await getServiceOrderSettings();
  validateStatus(status, settings);

  const current = await findServiceOrderById(id, user);
  if (!current) throw notFoundError(notFoundMessage);

  if (status === getFinalStatus(settings).id && !hasPermission(user, "service_orders.finish")) {
    throw forbidden("Voce nao possui permissao para finalizar esta Ordem de Servico.");
  }

  if (status !== getInitialStatus(settings).id && !current.assignedTechnicianName?.trim()) {
    throw badRequest("Defina um tecnico responsavel antes de avancar a ordem de servico.");
  }

  const serviceOrder = await updateServiceOrderStatus({ id, status, user });
  await syncServiceOrderMaintenance({ previous: current, serviceOrder, user, settings });
  await addLog({
    type: "service_order_status",
    message: `Service order status changed: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, status }
  });

  return serviceOrder;
}

export async function addServiceOrderHistoryEntry(id, body, user) {
  const current = await findServiceOrderById(id, user);
  if (!current) throw notFoundError(notFoundMessage);

  const message = body.message?.trim();
  if (!message) throw badRequest("Informe a descricao do historico.");

  const event = await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: body.eventType || "manual",
    message,
    oldValue: body.oldValue,
    newValue: body.newValue,
    user
  });

  if (current.assetId) {
    await addAssetHistory({
      assetId: current.assetId,
      eventType: body.eventType || "manual",
      message,
      oldValue: body.oldValue,
      newValue: body.newValue,
      userId: user.id,
      userName: user.name
    });
  }

  return event;
}

export async function removeServiceOrder(id, user) {
  const current = await findServiceOrderById(id, user);
  if (!current) throw notFoundError(notFoundMessage);

  if (current.backupAssetId) {
    throw conflict("Esta OS possui uma maquina Backup em uso. Devolva o Backup ou finalize a OS antes de excluir.");
  }

  await finishMaintenanceForAsset({
    serviceOrderId: current.id,
    notes: "Manutencao encerrada com a exclusao da OS.",
    user,
    allowMissing: true
  });

  const serviceOrder = await deleteServiceOrder(id, user);

  await addLog({
    type: "service_order_delete",
    message: `Service order deleted: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id, number: serviceOrder.number }
  });

  return serviceOrder;
}
