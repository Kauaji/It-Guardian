import { useBackupAllocation } from "./useBackupAllocation.js";
import { useBackupRelease } from "./useBackupRelease.js";

// Fluxo de maquina Backup vinculada a uma OS: alocar uma reserva no lugar da
// maquina principal (useBackupAllocation) e devolve-la quando a OS termina
// (useBackupRelease).
export function useServiceOrderBackupFlow(deps) {
  const { handleSelectBackupForServiceOrder } = useBackupAllocation(deps);
  const { releaseBackupForServiceOrder } = useBackupRelease(deps);

  return { releaseBackupForServiceOrder, handleSelectBackupForServiceOrder };
}
