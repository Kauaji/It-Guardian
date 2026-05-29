import { addLog } from "../repositories/logRepository.js";
import {
  getServiceOrderSettings,
  maxServiceOrderStatuses,
  updateServiceOrderSettings
} from "../repositories/serviceOrderRepository.js";

function slugifyStatusId(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

function sanitizeStatusPayload(payload = {}, fallbackOrder = 0) {
  const name = String(payload.name || payload.label || "").trim();
  const id = slugifyStatusId(payload.id || payload.value || name, `status_${Date.now()}`);
  const order = Number(payload.order);

  return {
    id,
    name: name || "Novo status",
    color: payload.color,
    order: Number.isFinite(order) ? Math.trunc(order) : fallbackOrder,
    isInitial: Boolean(payload.isInitial),
    isFinal: Boolean(payload.isFinal)
  };
}

function applyExclusiveFlags(statuses, status) {
  let next = statuses;

  if (status.isInitial) {
    next = next.map((item) => ({ ...item, isInitial: false }));
  }

  if (status.isFinal) {
    next = next.map((item) => ({ ...item, isFinal: false }));
  }

  return next;
}

export async function list(req, res, next) {
  try {
    const settings = await getServiceOrderSettings();
    res.json({ statuses: settings.statuses });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const settings = await getServiceOrderSettings();
    if (settings.statuses.length >= maxServiceOrderStatuses) {
      return res.status(400).json({ message: "Limite maximo de 10 status atingido." });
    }

    const status = sanitizeStatusPayload(req.body || {}, settings.statuses.length);
    if (settings.statuses.some((item) => item.id === status.id)) {
      return res.status(409).json({ message: "Ja existe um status com esse identificador." });
    }

    const statuses = [...applyExclusiveFlags(settings.statuses, status), status];
    const updated = await updateServiceOrderSettings({ ...settings, statuses });
    await addLog({
      type: "service_order_status_create",
      message: `Service order status created: ${status.name}`,
      userId: req.user.id,
      meta: { statusId: status.id }
    });

    res.status(201).json({
      status: updated.statuses.find((item) => item.id === status.id),
      statuses: updated.statuses
    });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const settings = await getServiceOrderSettings();
    const current = settings.statuses.find((status) => status.id === req.params.id);
    if (!current) return res.status(404).json({ message: "Status de OS nao encontrado." });

    const body = req.body || {};
    const status = {
      ...current,
      name: body.name !== undefined ? String(body.name || "").trim() || current.name : current.name,
      color: body.color !== undefined ? body.color : current.color,
      order: body.order !== undefined ? Number(body.order) : current.order,
      isInitial: body.isInitial !== undefined ? Boolean(body.isInitial) : current.isInitial,
      isFinal: body.isFinal !== undefined ? Boolean(body.isFinal) : current.isFinal
    };

    const statuses = applyExclusiveFlags(
      settings.statuses.filter((item) => item.id !== current.id),
      status
    ).concat(status);
    const updated = await updateServiceOrderSettings({ ...settings, statuses });
    await addLog({
      type: "service_order_status_update",
      message: `Service order status updated: ${status.name}`,
      userId: req.user.id,
      meta: { statusId: status.id }
    });

    res.json({
      status: updated.statuses.find((item) => item.id === status.id),
      statuses: updated.statuses
    });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const settings = await getServiceOrderSettings();
    const current = settings.statuses.find((status) => status.id === req.params.id);
    if (!current) return res.status(404).json({ message: "Status de OS nao encontrado." });
    if (settings.statuses.length <= 2) {
      return res.status(400).json({ message: "Mantenha pelo menos um status de abertura e um de finalizacao." });
    }

    const statuses = settings.statuses.filter((status) => status.id !== req.params.id);
    const updated = await updateServiceOrderSettings({ ...settings, statuses });
    await addLog({
      type: "service_order_status_delete",
      message: `Service order status deleted: ${current.name}`,
      userId: req.user.id,
      meta: { statusId: current.id }
    });

    res.json({ deleted: true, status: current, statuses: updated.statuses });
  } catch (error) {
    next(error);
  }
}
