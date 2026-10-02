import { updateDeviceBackup } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getBackupOrigin } from "../inventory/segmentLookups.js";

// Marcar/desmarcar ativos como reserva (Backup), individual e em lote.
export function useBackupActions({ data, deviceState, inventory }) {
  const { token, notify } = useAppSession();
  const { loadData } = data;
  const { selection } = inventory;

  async function handleToggleBackup(machine, desiredState) {
    if (!machine) return false;

    if (machine.backupStatus === "in_use" && desiredState === false) {
      notify("Esta máquina Backup está em uso por uma OS. Devolva ou finalize a OS antes de remover o Backup.", "danger");
      return false;
    }

    const nextIsBackup = desiredState ?? !machine.isBackup;

    try {
      const response = await updateDeviceBackup(token, machine.id, {
        isBackup: nextIsBackup,
        status: "available",
        ...getBackupOrigin(machine)
      });
      deviceState.upsertDeviceInState(response.device);
      notify(nextIsBackup ? `${machine.name} marcada como Backup.` : `${machine.name} removida da area de Backup.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleBulkMarkBackup() {
    const machines = selection.selectedAssets.filter((machine) => !machine.isBackup);
    if (!machines.length) {
      notify("As máquinas selecionadas já estão marcadas como Backup.", "ok");
      selection.clearAssetSelection();
      return false;
    }

    try {
      await Promise.all(
        machines.map((machine) =>
          updateDeviceBackup(token, machine.id, {
            isBackup: true,
            status: "available",
            ...getBackupOrigin(machine)
          })
        )
      );
      notify(`${machines.length} máquinas marcadas como Backup.`, "ok");
      selection.clearAssetSelection();
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  return { handleBulkMarkBackup, handleToggleBackup };
}
