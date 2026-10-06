import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import SettingsFormField from "./SettingsFormField.jsx";
import { buildProblemCategories, configs, emptyRecord, visibleByMode } from "./settingsConfigs.js";

export default function SettingsFormModal({ sectionId, record, records = [], businessMode, clients = [], onClose, onSubmit, saving }) {
  const config = configs[sectionId];
  const visibleFields = visibleByMode(config.fields, businessMode);
  const [form, setForm] = useState(() => ({ ...emptyRecord(config), ...(record || {}) }));
  const [categoryOptions, setCategoryOptions] = useState(() => buildProblemCategories(records));

  useEffect(() => {
    setForm({ ...emptyRecord(config), ...(record || {}) });
  }, [record, sectionId]);

  useEffect(() => {
    setCategoryOptions(buildProblemCategories(records));
  }, [records]);

  const dialogRef = useModalLifecycle(true, onClose);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function addCategoryOption() {
    const name = window.prompt("Nova categoria");
    const normalizedName = name?.trim();
    if (!normalizedName) return;

    setCategoryOptions((current) => [...new Set([...current, normalizedName])]);
    updateField("category", normalizedName);
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="modal-backdrop settings-modal-backdrop" role="presentation">
      <form
        ref={dialogRef}
        className="modal-panel settings-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-form-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <h2 id="settings-form-title">
              {record ? "Editar" : "Novo"} {config.singular}
            </h2>
            <p>Cadastro usado nas Ordens de Serviço.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {visibleFields.map((field) => (
          <SettingsFormField
            key={field.name}
            field={field}
            form={form}
            clients={clients}
            categoryOptions={categoryOptions}
            updateField={updateField}
            onAddCategory={addCategoryOption}
          />
        ))}

        <div className="modal-actions settings-wide-field">
          <button type="button" className="ghost-action" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-action compact-action" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
