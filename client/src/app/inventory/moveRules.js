// Regras puras da movimentação de ativos entre segmentos.

export const backupAreaMessage = "Use a ação Backup para enviar máquinas para a área de reserva.";
export const backupBlockedMessage = "Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.";

/** Máquina Backup disponível (não alocada a uma OS) não pode ser movida, salvo permissão explícita. */
export function isBackupMoveBlocked(machine, options = {}) {
  return Boolean(machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove);
}

/** Dispositivos pedidos que ainda não estão no segmento de destino. */
export function selectMachinesToMove(devices, machineIds, segmentId) {
  return devices.filter((device) => machineIds.includes(device.id) && device.segmentId !== segmentId);
}

/** Segmento anterior de cada máquina (para reverter a atualização otimista). */
export function snapshotPreviousSegments(machines) {
  return new Map(machines.map((machine) => [
    machine.id,
    { id: machine.segmentId, name: machine.segmentName }
  ]));
}

export function moveRequestOptions(options) {
  return options.reason ? { reason: options.reason } : {};
}
