import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { findServiceOrderSuggestionByServiceOrderId } from "../repositories/alertRepository.js";
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
  createServiceOrderAttachment,
  deleteServiceOrder,
  deleteServiceOrderAttachment,
  findServiceOrderById,
  findServiceOrderFeedback,
  getFinalStatus,
  getInitialStatus,
  getServiceOrderSettings,
  hasServiceOrderStatus,
  listServiceOrderAttachments,
  listServiceOrders,
  maxServiceOrderStatuses,
  reopenServiceOrder,
  serviceOrderPriorities,
  setFirstResponseAtIfNeeded,
  submitServiceOrderFeedback,
  updateServiceOrder,
  updateServiceOrderSettings,
  updateServiceOrderStatus
} from "../repositories/serviceOrderRepository.js";
import { applyChecklistTemplateOnCreate, assertChecklistCompleteForFinish } from "./serviceOrderChecklistService.js";

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

  // So busca a sugestao de alerta relacionada quando a origem indica isso -
  // evita uma consulta extra desnecessaria pra OS manuais/publicas.
  const relatedAlertSuggestion =
    serviceOrder.source === "alert_suggestion"
      ? await findServiceOrderSuggestionByServiceOrderId(id)
      : null;

  return { ...serviceOrder, relatedAlertSuggestion };
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
  await applyChecklistTemplateOnCreate(serviceOrder);
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

  if (assignedTechnicianName) {
    await setFirstResponseAtIfNeeded(id);
  }

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

  if (status === getFinalStatus(settings).id) {
    await assertChecklistCompleteForFinish(id);
  }

  const serviceOrder = await updateServiceOrderStatus({ id, status, user });
  if (status !== getInitialStatus(settings).id) {
    await setFirstResponseAtIfNeeded(id);
  }
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
  await setFirstResponseAtIfNeeded(id);

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

// Caminho dedicado de reabertura: exige motivo, permissao propria
// (service_orders.reopen), incrementa reopen_count e reinicia o prazo de
// SLA. Complementa (nao substitui) o dropdown de status generico, que ja
// tratava "voltar pro status inicial" como reopened sem exigir motivo -
// esse comportamento existente foi preservado de proposito.
export async function reopenServiceOrderEntry(id, payload, user) {
  const serviceOrder = await reopenServiceOrder({ id, reason: payload?.reason, user });
  if (!serviceOrder) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_reopen",
    message: `Service order reopened: ${serviceOrder.number}`,
    userId: user.id,
    meta: { serviceOrderId: serviceOrder.id }
  });

  return serviceOrder;
}

export async function submitServiceOrderFeedbackEntry(id, payload, user) {
  const feedback = await submitServiceOrderFeedback({
    id,
    rating: payload?.rating,
    comment: payload?.comment,
    user
  });
  if (!feedback) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_feedback",
    message: `Service order feedback submitted: ${id}`,
    userId: user.id,
    meta: { serviceOrderId: id, rating: feedback.rating }
  });

  return feedback;
}

export async function getServiceOrderFeedbackEntry(id, user) {
  const current = await findServiceOrderById(id, user);
  if (!current) throw notFoundError(notFoundMessage);
  return findServiceOrderFeedback(id);
}

export async function listServiceOrderAttachmentsEntry(id, user) {
  const current = await findServiceOrderById(id, user);
  if (!current) throw notFoundError(notFoundMessage);
  return listServiceOrderAttachments(id);
}

export async function createServiceOrderAttachmentEntry(id, payload, user) {
  const attachment = await createServiceOrderAttachment({
    serviceOrderId: id,
    fileName: payload?.fileName,
    fileType: payload?.fileType,
    fileSize: payload?.fileSize,
    storageKey: payload?.storageKey,
    category: payload?.category,
    description: payload?.description,
    user
  });
  if (!attachment) throw notFoundError(notFoundMessage);

  await addLog({
    type: "service_order_attachment_add",
    message: `Service order attachment added: ${attachment.fileName}`,
    userId: user.id,
    meta: { serviceOrderId: id, attachmentId: attachment.id }
  });

  return attachment;
}

export async function deleteServiceOrderAttachmentEntry(id, attachmentId, user) {
  const attachment = await deleteServiceOrderAttachment(id, attachmentId, user);
  if (!attachment) throw notFoundError("Anexo nao encontrado.");

  await addLog({
    type: "service_order_attachment_remove",
    message: `Service order attachment removed: ${attachment.fileName}`,
    userId: user.id,
    meta: { serviceOrderId: id, attachmentId }
  });

  return attachment;
}
