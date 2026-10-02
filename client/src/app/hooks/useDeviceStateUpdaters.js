// Atualizacoes otimistas da lista de dispositivos (allDevices, devices e o
// dispositivo selecionado) usadas pelos fluxos de movimentacao, backup,
// manutencao e perifericos.
export function useDeviceStateUpdaters({ data }) {
  const { setAllDevices, setDevices, setSelectedDevice } = data;

  // `patch` recebe o dispositivo atual e devolve o novo; so e chamado para o
  // dispositivo com o id informado.
  function patchDeviceInState(deviceId, patch) {
    const update = (device) => (device.id === deviceId ? patch(device) : device);

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === deviceId ? update(current) : current));
  }

  function updateDeviceSegmentInState(deviceId, segmentId, segmentName, extra = {}) {
    patchDeviceInState(deviceId, (device) => ({ ...device, segmentId, segmentName, ...extra }));
  }

  function appendDeviceHistoryEvent(machineId, event) {
    patchDeviceInState(machineId, (device) => ({
      ...device,
      assetHistory: [event, ...(device.assetHistory || [])]
    }));
  }

  function upsertDeviceInState(device) {
    setAllDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return [...current, device];
    });
    setDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return current;
    });
    setSelectedDevice((current) => (current?.id === device.id ? device : current));
  }

  function removeDeviceFromState(deviceId) {
    setAllDevices((current) => current.filter((device) => device.id !== deviceId));
    setDevices((current) => current.filter((device) => device.id !== deviceId));
    setSelectedDevice((current) => (current?.id === deviceId ? null : current));
  }

  return {
    appendDeviceHistoryEvent,
    patchDeviceInState,
    removeDeviceFromState,
    updateDeviceSegmentInState,
    upsertDeviceInState
  };
}
