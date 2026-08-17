import { query } from "../database.js";
import { badRequest, conflict, notFoundError } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import {
  getServiceOrderSettings,
  maxServiceOrderStatuses,
  updateServiceOrderSettings
} from "../repositories/serviceOrderRepository.js";

function stripCombiningMarks(value) {
  let result = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code < 0x0300 || code > 0x036f) result += char;
  }
  return result;
}

function slugifyStatusId(value, fallback) {
  const normalized = stripCombiningMarks(String(value || "").normalize("NFD"))
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

export async function listStatuses() {
  const settings = await getServiceOrderSettings();
  return settings.statuses;
}

export async function createStatus(payload, user) {
  const settings = await getServiceOrderSettings();
  if (settings.statuses.length >= maxServiceOrderStatuses) {
    throw badRequest("Limite maximo de 10 status atingido.");
  }

  const status = sanitizeStatusPayload(payload || {}, settings.statuses.length);
  if (settings.statuses.some((item) => item.id === status.id)) {
    throw conflict("Ja existe um status com esse identificador.");
  }

  const statuses = [...applyExclusiveFlags(settings.statuses, status), status];
  const updated = await updateServiceOrderSettings({ ...settings, statuses });
  await addLog({
    type: "service_order_status_create",
    message: `Service order status created: ${status.name}`,
    userId: user.id,
    meta: { statusId: status.id }
  });

  return {
    status: updated.statuses.find((item) => item.id === status.id),
    statuses: updated.statuses
  };
}

export async function updateStatus(id, body, user) {
  const settings = await getServiceOrderSettings();
  const current = settings.statuses.find((status) => status.id === id);
  if (!current) throw notFoundError("Status de OS nao encontrado.");

  const payload = body || {};
  const status = {
    ...current,
    name: payload.name !== undefined ? String(payload.name || "").trim() || current.name : current.name,
    color: payload.color !== undefined ? payload.color : current.color,
    order: payload.order !== undefined ? Number(payload.order) : current.order,
    isInitial: payload.isInitial !== undefined ? Boolean(payload.isInitial) : current.isInitial,
    isFinal: payload.isFinal !== undefined ? Boolean(payload.isFinal) : current.isFinal
  };

  const statuses = applyExclusiveFlags(
    settings.statuses.filter((item) => item.id !== current.id),
    status
  ).concat(status);
  const updated = await updateServiceOrderSettings({ ...settings, statuses });
  await addLog({
    type: "service_order_status_update",
    message: `Service order status updated: ${status.name}`,
    userId: user.id,
    meta: { statusId: status.id }
  });

  return {
    status: updated.statuses.find((item) => item.id === status.id),
    statuses: updated.statuses
  };
}

export async function removeStatus(id, user) {
  const settings = await getServiceOrderSettings();
  const current = settings.statuses.find((status) => status.id === id);
  if (!current) throw notFoundError("Status de OS nao encontrado.");
  if (settings.statuses.length <= 2) {
    throw badRequest("Mantenha pelo menos um status de abertura e um de finalizacao.");
  }
  const usageResult = await query("SELECT COUNT(*)::int AS total FROM service_orders WHERE status = $1", [current.id]);
  if (Number(usageResult.rows[0]?.total || 0) > 0) {
    throw badRequest("Mova as OS deste status antes de exclui-lo.");
  }

  const statuses = settings.statuses.filter((status) => status.id !== id);
  const updated = await updateServiceOrderSettings({ ...settings, statuses });
  await addLog({
    type: "service_order_status_delete",
    message: `Service order status deleted: ${current.name}`,
    userId: user.id,
    meta: { statusId: current.id }
  });

  return { deleted: true, status: current, statuses: updated.statuses };
}
