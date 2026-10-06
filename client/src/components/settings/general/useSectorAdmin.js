import { useState } from "react";
import { createSector, deleteSector, updateSector } from "../../../api.js";
import {
  buildSectorPayload,
  emptySectorForm,
  sectorToForm,
  upsertRecord
} from "./adminForms.js";

/** Formulário e ações de setores da aba Admin (criar, editar, desativar). */
export function useSectorAdmin({ token, notify, setSectors, setSaving }) {
  const [sectorForm, setSectorForm] = useState(emptySectorForm);

  function resetSectorForm() {
    setSectorForm(emptySectorForm());
  }

  function editSector(item) {
    setSectorForm(sectorToForm(item));
  }

  async function submitSectorForm(event) {
    event.preventDefault();

    if (!sectorForm.name.trim()) {
      notify("Informe o nome do setor.", "danger");
      return;
    }

    setSaving(true);
    try {
      const payload = buildSectorPayload(sectorForm);
      const response = sectorForm.id
        ? await updateSector(token, sectorForm.id, payload)
        : await createSector(token, payload);

      setSectors((current) => upsertRecord(current, response.sector, Boolean(sectorForm.id)));
      resetSectorForm();
      notify(sectorForm.id ? "Setor atualizado." : "Setor criado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateSector(id) {
    if (!window.confirm("Deseja desativar este setor? Os usuários continuam existindo.")) return;

    setSaving(true);
    try {
      const response = await deleteSector(token, id);
      setSectors((current) => current.map((item) => (item.id === id ? response.sector : item)));
      notify("Setor desativado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  return { sectorForm, setSectorForm, resetSectorForm, editSector, submitSectorForm, deactivateSector };
}
