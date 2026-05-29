import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { hasPermission } from "../permissions.js";
import {
  addServiceOrderHistory,
  createServiceOrder,
  deleteServiceOrder,
  findServiceOrderById,
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

function validateCreatePayload(payload) {
  const title = payload.title?.trim();

  if (!title || title.length < 3) {
    const error = new Error("O titulo da ordem de servico deve ter pelo menos 3 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.priority && !serviceOrderPriorities.has(payload.priority)) {
    const error = new Error("Prioridade de OS invalida.");
    error.statusCode = 400;
    throw error;
  }
}

function validateStatus(status, settings) {
  if (!status || !hasServiceOrderStatus(settings, status)) {
    const error = new Error("Status de OS invalido.");
    error.statusCode = 400;
    throw error;
  }
}

export async function list(req, res, next) {
  try {
    const serviceOrders = await listServiceOrders(req.user);
    res.json({ serviceOrders });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const serviceOrder = await findServiceOrderById(req.params.id, req.user);
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function settings(req, res, next) {
  try {
    res.json({ settings: await getServiceOrderSettings() });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    if (Array.isArray(req.body?.statuses) && req.body.statuses.length > maxServiceOrderStatuses) {
      return res.status(400).json({ message: "Limite maximo de 10 status atingido." });
    }

    const settings = await updateServiceOrderSettings(req.body || {});
    await addLog({
      type: "service_order_settings",
      message: "Service order settings updated",
      userId: req.user.id,
      meta: {}
    });
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    validateCreatePayload(req.body);

    const serviceOrder = await createServiceOrder({ payload: req.body, user: req.user });
    await addLog({
      type: "service_order_create",
      message: `Service order created: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id }
    });

    res.status(201).json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const hasSectorPayload =
      Object.prototype.hasOwnProperty.call(req.body || {}, "sectorId") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "sectorName");

    if (hasSectorPayload && !hasPermission(req.user, "service_orders.change_sector")) {
      return res.status(403).json({ message: "Voce nao possui permissao para alterar o setor da OS." });
    }

    if (req.body.priority && !serviceOrderPriorities.has(req.body.priority)) {
      return res.status(400).json({ message: "Prioridade de OS invalida." });
    }

    if (req.body.status) {
      const settings = await getServiceOrderSettings();
      validateStatus(req.body.status, settings);
    }

    const serviceOrder = await updateServiceOrder({ id: req.params.id, payload: req.body, user: req.user });
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    await addLog({
      type: "service_order_update",
      message: `Service order updated: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id }
    });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function changePriority(req, res, next) {
  try {
    const priority = req.body?.priority;
    if (!serviceOrderPriorities.has(priority)) {
      return res.status(400).json({ message: "Prioridade de OS invalida." });
    }

    const serviceOrder = await updateServiceOrder({
      id: req.params.id,
      payload: { priority },
      user: req.user
    });
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    await addLog({
      type: "service_order_priority",
      message: `Service order priority changed: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, priority }
    });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function assignTechnician(req, res, next) {
  try {
    const assignedTechnicianName = String(
      req.body?.assignedTechnicianName ?? req.body?.technicianName ?? req.body?.name ?? ""
    ).trim();

    const serviceOrder = await updateServiceOrder({
      id: req.params.id,
      payload: { assignedTechnicianName: assignedTechnicianName || null },
      user: req.user
    });
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    await addLog({
      type: "service_order_technician",
      message: `Service order technician changed: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, assignedTechnicianName: assignedTechnicianName || null }
    });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function linkAsset(req, res, next) {
  try {
    const payload = {
      assetId: req.body?.assetId ?? req.body?.asset_id ?? null,
      environmentId: req.body?.environmentId ?? req.body?.environment_id,
      environmentName: req.body?.environmentName ?? req.body?.environment_name,
      relatedAssetText: req.body?.relatedAssetText ?? req.body?.related_asset_text,
      machineScope: req.body?.machineScope ?? req.body?.machine_scope,
      location: req.body?.location
    };

    const serviceOrder = await updateServiceOrder({ id: req.params.id, payload, user: req.user });
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    await addLog({
      type: "service_order_asset",
      message: `Service order asset changed: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, assetId: payload.assetId }
    });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function replaceItems(req, res, next) {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items ?? req.body?.serviceItems ?? [];
    const serviceOrder = await updateServiceOrder({
      id: req.params.id,
      payload: { items },
      user: req.user
    });
    if (!serviceOrder) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    await addLog({
      type: "service_order_items",
      message: `Service order items changed: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, itemsCount: Array.isArray(items) ? items.length : 0 }
    });

    res.status(201).json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req, res, next) {
  try {
    const status = req.body.status;
    const settings = await getServiceOrderSettings();
    validateStatus(status, settings);

    const current = await findServiceOrderById(req.params.id, req.user);
    if (!current) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    if (status !== getInitialStatus(settings).id && !current.assignedTechnicianName?.trim()) {
      return res.status(400).json({
        message: "Defina um tecnico responsavel antes de avancar a ordem de servico."
      });
    }

    const serviceOrder = await updateServiceOrderStatus({ id: req.params.id, status, user: req.user });
    await addLog({
      type: "service_order_status",
      message: `Service order status changed: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, status }
    });

    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function addHistory(req, res, next) {
  try {
    const current = await findServiceOrderById(req.params.id, req.user);
    if (!current) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    const message = req.body.message?.trim();
    if (!message) return res.status(400).json({ message: "Informe a descricao do historico." });

    const event = await addServiceOrderHistory({
      serviceOrderId: req.params.id,
      eventType: req.body.eventType || "manual",
      message,
      oldValue: req.body.oldValue,
      newValue: req.body.newValue,
      user: req.user
    });

    if (current.assetId) {
      await addAssetHistory({
        assetId: current.assetId,
        eventType: req.body.eventType || "manual",
        message,
        oldValue: req.body.oldValue,
        newValue: req.body.newValue,
        userId: req.user.id,
        userName: req.user.name
      });
    }

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const current = await findServiceOrderById(req.params.id, req.user);
    if (!current) return res.status(404).json({ message: "Ordem de servico nao encontrada." });

    if (current.backupAssetId) {
      return res.status(409).json({
        message: "Esta OS possui uma maquina Backup em uso. Devolva o Backup ou finalize a OS antes de excluir."
      });
    }

    const serviceOrder = await deleteServiceOrder(req.params.id);

    await addLog({
      type: "service_order_delete",
      message: `Service order deleted: ${serviceOrder.number}`,
      userId: req.user.id,
      meta: { serviceOrderId: serviceOrder.id, number: serviceOrder.number }
    });

    res.json({ deleted: true, serviceOrder });
  } catch (error) {
    next(error);
  }
}
