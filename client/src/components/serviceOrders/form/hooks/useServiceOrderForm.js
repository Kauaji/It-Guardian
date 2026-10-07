import { useEffect, useMemo, useState } from "react";
import {
  buildInitialForm,
  buildResetFields,
  buildSubmitPayload,
  defaultSectors,
  resolveSector,
  toggleTechnician,
  validateServiceOrderForm
} from "../utils/formModel.js";

// Estado, selecoes derivadas e envio do formulario de nova OS.
export function useServiceOrderForm({
  open,
  businessMode,
  activeTab,
  tabs,
  devices,
  sectors,
  serviceOrderSettings,
  clients,
  saving,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm(serviceOrderSettings));
  const [thirdPartyRequester, setThirdPartyRequester] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setThirdPartyRequester(false);
    setForm((current) => ({ ...current, ...buildResetFields({ businessMode, activeTab, serviceOrderSettings }) }));
  }, [activeTab?.id, businessMode, open, serviceOrderSettings?.autoPriority?.enabled]);

  const selectedAsset = useMemo(() => devices.find((device) => device.id === form.assetId), [devices, form.assetId]);
  const selectedEnvironment = tabs.find((tab) => tab.id === form.environmentId) || activeTab;
  const selectedClient = clients.find((client) => client.id === form.environmentId);
  const availableSectors = sectors.length ? sectors : defaultSectors;
  const selectedSector = resolveSector(availableSectors, form.sectorId);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function toggleThirdPartyRequester(checked) {
    setThirdPartyRequester(checked);
    setForm((current) => ({ ...current, requesterName: "" }));
    setFormError("");
  }

  function toggleAssignedTechnician(name) {
    setForm((current) => toggleTechnician(current, name));
    setFormError("");
  }

  function submit(event) {
    event.preventDefault();
    const fields = {
      title: form.title.trim(),
      description: form.description.trim(),
      requesterName: form.requesterName.trim(),
      category: form.category.trim()
    };

    if (saving) return;

    const error = validateServiceOrderForm({ ...fields, assetId: form.assetId, businessMode, selectedClient });
    if (error) {
      setFormError(error);
      return;
    }

    onSubmit(buildSubmitPayload({ form, fields, businessMode, selectedClient, selectedEnvironment, selectedSector }));
  }

  return {
    form,
    formError,
    thirdPartyRequester,
    selectedAsset,
    availableSectors,
    updateField,
    toggleThirdPartyRequester,
    toggleAssignedTechnician,
    submit
  };
}
