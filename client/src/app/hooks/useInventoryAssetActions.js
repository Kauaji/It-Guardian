import { useState } from "react";
import {
  createManualAsset,
  deleteDevice,
  refreshAssetPing,
  updateDeviceAlias,
  updateDeviceType
} from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";

// Acoes sobre ativos individuais: cadastro manual, ping, tipo, remocao, nome
// fantasia e observacoes.
export function useInventoryAssetActions({ data, deviceState, inventory, meta }) {
  const { token, notify, user } = useAppSession();
  const { model, persistence, selection } = inventory;
  const { activeAllDevices, activeInventoryTab } = model;
  const { loadData } = data;
  const [manualAssetFormOpen, setManualAssetFormOpen] = useState(false);
  const [manualAssetSaving, setManualAssetSaving] = useState(false);

  async function removeMachineFromInventory(machine) {
    if (!machine) return false;

    const confirmed = window.confirm(
      `Remover "${machine.name}" do inventário?\n\nA máquina/ativo deixará de aparecer no inventário. Esta ação deve ser usada apenas quando o equipamento saiu do ambiente monitorado.`
    );
    if (!confirmed) return false;

    try {
      await deleteDevice(token, machine.id);
      deviceState.removeDeviceFromState(machine.id);
      selection.deselectAsset(machine.id);
      notify(`${machine.name} removida do inventário.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleCreateManualAsset(payload) {
    setManualAssetSaving(true);
    try {
      const response = await createManualAsset(token, payload);
      deviceState.upsertDeviceInState(response.device);
      meta.updateInventoryMeta("devices", response.device.id, {
        tabId: activeInventoryTab.id,
        order: activeAllDevices.length
      });
      setManualAssetFormOpen(false);
      notify(`Ativo ${response.device.name} criado.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setManualAssetSaving(false);
    }
  }

  async function handleRefreshPing(machine) {
    if (!machine || machine.source !== "manual") return;

    try {
      const response = await refreshAssetPing(token, machine.id);
      deviceState.upsertDeviceInState(response.device);
      notify(response.ping.message, response.device.status === "online" ? "ok" : "danger");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleChangeDeviceType(deviceId, assetType) {
    try {
      const response = await updateDeviceType(token, deviceId, assetType);
      deviceState.upsertDeviceInState(response.device);
      notify("Tipo do aparelho atualizado.", "ok");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function saveMachineAlias(machineId, alias) {
    try {
      const machine = activeAllDevices.find((device) => String(device.id) === String(machineId));
      if (machine?.source === "agent") {
        await updateDeviceAlias(token, machineId, alias);
      }
      persistence.saveMachineAliases((current) => {
        const next = { ...current };
        if (alias) {
          next[machineId] = alias;
        } else {
          delete next[machineId];
        }
        return next;
      });
      notify(alias ? "Nome fantasia atualizado." : "Nome fantasia removido.", "ok");
    } catch (error) {
      notify(error.message || "Não foi possível atualizar o nome fantasia.", "error");
      throw error;
    }
  }

  function addMachineObservation(machineId, text) {
    persistence.saveMachineObservations((current) => ({
      ...current,
      [machineId]: [
        {
          id: `${machineId}-${Date.now()}`,
          createdAt: new Date().toISOString(),
          user: user.name,
          text
        },
        ...(current[machineId] || [])
      ]
    }));
    notify("Observação adicionada.", "ok");
  }

  return {
    addMachineObservation,
    handleChangeDeviceType,
    handleCreateManualAsset,
    handleRefreshPing,
    manualAssetFormOpen,
    manualAssetSaving,
    openManualAssetForm: () => setManualAssetFormOpen(true),
    closeManualAssetForm: () => setManualAssetFormOpen(false),
    removeMachineFromInventory,
    saveMachineAlias
  };
}
