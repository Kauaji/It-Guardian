import { useAppSession } from "../../context/AppSessionContext.jsx";
import { peripheralKey } from "../../components/inventory/inventoryLocalState.js";

function describePeripheral(peripheral) {
  return `${peripheral.type} - ${peripheral.brand || "Sem marca"} - ${peripheral.assetTag || "Sem patrimonio"}`;
}

function peripheralLabel(peripheral) {
  return `${peripheral.type} ${peripheral.brand || ""} ${peripheral.assetTag || ""}`.trim();
}

// Perifericos de um ativo: o cadastro e local e cada alteracao vira um evento
// no historico de perifericos e no historico do ativo.
export function useMachinePeripherals({ deviceState, inventory }) {
  const { notify, user } = useAppSession();
  const { persistence } = inventory;

  function removeMachinePeripheral(machineId, peripheral) {
    const confirmed = window.confirm(`Remover periferico "${peripheral.type}" deste ativo?`);
    if (!confirmed) return null;

    const removedKey = peripheralKey(peripheral);
    const event = {
      id: `${machineId}-peripheral-removed-${Date.now()}`,
      createdAt: new Date().toISOString(),
      user: user.name,
      change: `Periferico removido: ${peripheral.type}`,
      message: describePeripheral(peripheral),
      field: "peripherals",
      oldValue: peripheralLabel(peripheral),
      newValue: "Removido"
    };

    persistence.saveManualPeripherals((current) => ({
      ...current,
      [machineId]: (current[machineId] || []).filter((item) => peripheralKey(item) !== removedKey)
    }));
    persistence.savePeripheralHistory((current) => ({
      ...current,
      [machineId]: [event, ...(current[machineId] || [])]
    }));

    deviceState.patchDeviceInState(machineId, (device) => ({
      ...device,
      assetHistory: [event, ...(device.assetHistory || [])],
      hardware: {
        ...device.hardware,
        peripherals: (device.hardware?.peripherals || []).filter((item) => peripheralKey(item) !== removedKey)
      }
    }));
    notify("Periferico removido e registrado no historico.", "ok");
    return event;
  }

  function addMachinePeripheral(machineId, peripheral) {
    const item = {
      ...peripheral,
      id: peripheral.id || `${machineId}-peripheral-${Date.now()}`
    };
    const event = {
      id: `${machineId}-peripheral-added-${Date.now()}`,
      createdAt: new Date().toISOString(),
      user: user.name,
      change: `Periferico adicionado: ${item.type}`,
      message: describePeripheral(item),
      field: "peripherals",
      oldValue: "Nao cadastrado",
      newValue: peripheralLabel(item)
    };

    persistence.saveManualPeripherals((current) => ({
      ...current,
      [machineId]: [...(current[machineId] || []), item]
    }));
    persistence.savePeripheralHistory((current) => ({
      ...current,
      [machineId]: [event, ...(current[machineId] || [])]
    }));

    deviceState.patchDeviceInState(machineId, (device) => ({
      ...device,
      assetHistory: [event, ...(device.assetHistory || [])],
      hardware: {
        ...device.hardware,
        peripherals: [...(device.hardware?.peripherals || []), item]
      }
    }));
    notify("Periferico adicionado e registrado no historico.", "ok");
    return { peripheral: item, event };
  }

  return { addMachinePeripheral, removeMachinePeripheral };
}
