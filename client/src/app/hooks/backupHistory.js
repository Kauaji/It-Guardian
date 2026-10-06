// Evento de histórico de um ativo ligado ao fluxo de máquina Backup.
export function buildBackupHistoryEvent({ machineId, key, userName, message, oldValue, newValue }) {
  return {
    id: `${machineId}-${key}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    userName,
    eventType: "backup",
    message,
    oldValue,
    newValue
  };
}
