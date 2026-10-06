import { defaultPriorityColors, maxServiceOrderStatuses, normalizeStatuses } from "../../serviceOrderBoardUtils.js";

// Transformacoes puras das configuracoes da OS editadas no modal (sem estado, sem efeitos).

export const MIN_STATUSES = 2;

export function setSectionField(settings, section, field, value) {
  return {
    ...settings,
    [section]: {
      ...settings[section],
      [field]: value
    }
  };
}

export function setSettingValue(settings, field, value) {
  return { ...settings, [field]: value };
}

export function patchStatus(settings, statusId, patch) {
  return {
    ...settings,
    statuses: normalizeStatuses(
      settings.statuses.map((status) => (status.id === statusId ? { ...status, ...patch } : status))
    )
  };
}

/** Acrescenta um status novo; devolve null quando o limite de status foi atingido. */
export function appendStatus(settings, id) {
  const statuses = normalizeStatuses(settings.statuses);
  if (statuses.length >= maxServiceOrderStatuses) return null;
  const nextIndex = statuses.length + 1;
  return {
    ...settings,
    statuses: normalizeStatuses([
      ...statuses,
      {
        id,
        name: `Novo status ${nextIndex}`,
        color: "#64748b",
        order: statuses.length,
        isInitial: false,
        isFinal: false
      }
    ])
  };
}

export function removeStatus(settings, statusId) {
  return {
    ...settings,
    statuses: normalizeStatuses(settings.statuses.filter((item) => item.id !== statusId))
  };
}

/** Troca o status de posicao com o vizinho (direction -1 sobe, +1 desce). */
export function moveStatusBy(settings, statusId, direction) {
  const statuses = normalizeStatuses(settings.statuses);
  const index = statuses.findIndex((status) => status.id === statusId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= statuses.length) return settings;

  const reordered = [...statuses];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  return {
    ...settings,
    statuses: normalizeStatuses(reordered.map((status, order) => ({ ...status, order })))
  };
}

/** Marca o status como abertura ou finalizacao (exclusivo entre os dois papeis). */
export function assignStatusRole(settings, statusId, role) {
  const roleKey = role === "initial" ? "isInitial" : "isFinal";
  return {
    ...settings,
    statuses: normalizeStatuses(
      settings.statuses.map((status) => ({
        ...status,
        [roleKey]: status.id === statusId,
        ...(role === "initial" && status.id === statusId ? { isFinal: false } : {}),
        ...(role === "final" && status.id === statusId ? { isInitial: false } : {})
      }))
    )
  };
}

export function hasAnotherWithRole(statuses, statusId, role) {
  const roleKey = role === "initial" ? "isInitial" : "isFinal";
  return normalizeStatuses(statuses).some((status) => status[roleKey] && status.id !== statusId);
}

export function getRoleReplaceMessage(role) {
  return role === "initial"
    ? "Já existe um status definido como abertura. Deseja substituir?"
    : "Já existe um status definido como finalização. Deseja substituir?";
}

/** Motivo pelo qual o status nao pode ser excluido, ou null quando pode (confirmacao a parte). */
export function getStatusDeletionBlock(statuses, serviceOrders, statusId) {
  const currentStatuses = normalizeStatuses(statuses);
  const status = currentStatuses.find((item) => item.id === statusId);
  if (!status) return { status: null, message: "" };
  if (currentStatuses.length <= MIN_STATUSES) {
    return { status, message: "Mantenha pelo menos um status de abertura e um de finalização." };
  }
  if (serviceOrders.some((order) => order.status === statusId)) {
    return { status, message: "Mova as OS deste status antes de excluí-lo." };
  }
  return { status, message: "" };
}

export function setPriorityColor(settings, priority, color) {
  return {
    ...settings,
    priorityColors: {
      ...settings.priorityColors,
      [priority]: color
    }
  };
}

export function resetPriorityColors(settings) {
  return { ...settings, priorityColors: defaultPriorityColors };
}
