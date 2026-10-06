import { useEffect, useMemo, useState } from "react";
import { fetchServiceOrderSettings, updateServiceOrderSettings } from "../../../../api.js";
import {
  defaultPriorityColors,
  defaultServiceOrderSettings,
  mergeServiceOrderSettings,
  normalizeStatuses
} from "../../serviceOrderBoardUtils.js";
import {
  appendStatus,
  assignStatusRole,
  getRoleReplaceMessage,
  getStatusDeletionBlock,
  hasAnotherWithRole,
  moveStatusBy,
  patchStatus,
  removeStatus,
  resetPriorityColors as resetColors,
  setPriorityColor,
  setSectionField,
  setSettingValue
} from "../utils/settingsEditing.js";

// Configuracoes da OS: carga inicial, edicao local (status, cores, numero, SLA...) e salvamento.
export function useServiceOrderSettings({ token, notify, serviceOrders }) {
  const [serviceOrderSettings, setServiceOrderSettings] = useState(defaultServiceOrderSettings);
  const [priorityColors, setPriorityColors] = useState(defaultPriorityColors);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const configuredStatuses = useMemo(() => normalizeStatuses(serviceOrderSettings.statuses), [serviceOrderSettings.statuses]);
  const finalStatusIds = useMemo(
    () => configuredStatuses.filter((status) => status.isFinal).map((status) => status.id),
    [configuredStatuses]
  );

  function applyServerSettings(settings) {
    const merged = mergeServiceOrderSettings(settings);
    setServiceOrderSettings(merged);
    setPriorityColors(merged.priorityColors);
  }

  useEffect(() => {
    if (!token) return;

    fetchServiceOrderSettings(token)
      .then((response) => applyServerSettings(response.settings))
      .catch((error) => notify?.(error.message, "danger"));
  }, [token]);

  function updateServiceOrderSettingsField(section, field, value) {
    setServiceOrderSettings((current) => setSectionField(current, section, field, value));
  }

  function updateServiceOrderSetting(field, value) {
    setServiceOrderSettings((current) => setSettingValue(current, field, value));
  }

  function updateStatus(statusId, patch) {
    setServiceOrderSettings((current) => patchStatus(current, statusId, patch));
  }

  function addStatus() {
    setServiceOrderSettings((current) => {
      const next = appendStatus(current, `status_${Date.now()}`);
      if (!next) {
        notify?.("Limite máximo de 10 status atingido.", "danger");
        return current;
      }
      return next;
    });
  }

  function deleteStatus(statusId) {
    const { status, message } = getStatusDeletionBlock(serviceOrderSettings.statuses, serviceOrders, statusId);

    if (!status) return;
    if (message) {
      notify?.(message, "danger");
      return;
    }
    if (!window.confirm(`Excluir o status "${status.name}"?`)) return;

    setServiceOrderSettings((current) => removeStatus(current, statusId));
  }

  function moveStatus(statusId, direction) {
    setServiceOrderSettings((current) => moveStatusBy(current, statusId, direction));
  }

  function setStatusRole(statusId, role) {
    if (hasAnotherWithRole(serviceOrderSettings.statuses, statusId, role) && !window.confirm(getRoleReplaceMessage(role))) return;

    setServiceOrderSettings((current) => assignStatusRole(current, statusId, role));
  }

  async function saveServiceOrderSettings() {
    setSettingsSaving(true);
    try {
      const response = await updateServiceOrderSettings(token, serviceOrderSettings);
      applyServerSettings(response.settings);
      notify?.("Configurações da OS salvas.", "ok");
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSettingsSaving(false);
    }
  }

  function changePriorityColor(priority, color) {
    setPriorityColors((current) => ({
      ...current,
      [priority]: color
    }));
    setServiceOrderSettings((current) => setPriorityColor(current, priority, color));
  }

  function resetPriorityColors() {
    setPriorityColors(defaultPriorityColors);
    setServiceOrderSettings(resetColors);
  }

  return {
    serviceOrderSettings,
    priorityColors,
    settingsSaving,
    configuredStatuses,
    finalStatusIds,
    updateServiceOrderSettingsField,
    updateServiceOrderSetting,
    updateStatus,
    addStatus,
    deleteStatus,
    moveStatus,
    setStatusRole,
    saveServiceOrderSettings,
    changePriorityColor,
    resetPriorityColors
  };
}
