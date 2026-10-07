import { useState } from "react";
import { X } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { EMPTY_PART, numberOrText } from "../utils/partsModel.js";

const CONDITION_OPTIONS = [
  ["new", "Nova"],
  ["used", "Usada"],
  ["refurbished", "Recondicionada"],
  ["damaged", "Danificada"]
];

export default function PartForm({ part, categories, saving, onClose, onSave }) {
  const [form, setForm] = useState(part ? { ...EMPTY_PART, ...part } : EMPTY_PART);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: numberOrText(event.target) }));
  const dialogRef = useModalLifecycle(true, onClose);
  return (
    <div className="parts-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form
        ref={dialogRef}
        className="parts-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parts-form-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <header>
          <div>
            <span>Cadastro rastreável</span>
            <h2 id="parts-form-title">{part ? "Editar peça" : "Nova peça"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <div className="parts-form-grid">
          <label className="wide">
            Nome
            <input value={form.name} onChange={set("name")} required />
          </label>
          <label>
            Categoria
            <select value={form.category || ""} onChange={set("category")} required>
              <option value="">Selecione</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fabricante
            <input value={form.brand || ""} onChange={set("brand")} />
          </label>
          <label>
            Modelo
            <input value={form.model || ""} onChange={set("model")} />
          </label>
          <label>
            Código interno
            <input value={form.internalCode || ""} onChange={set("internalCode")} />
          </label>
          <label>
            Part number
            <input value={form.manufacturerPartNumber || ""} onChange={set("manufacturerPartNumber")} />
          </label>
          <label>
            Número de série
            <input value={form.serialNumber || ""} onChange={set("serialNumber")} />
          </label>
          <label>
            MAC
            <input value={form.macAddress || ""} onChange={set("macAddress")} />
          </label>
          <label>
            Localização
            <input value={form.location || ""} onChange={set("location")} placeholder="Almoxarifado / prateleira" />
          </label>
          <label>
            Condição
            <select value={form.conditionStatus} onChange={set("conditionStatus")}>
              {CONDITION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {!part ? (
            <label>
              Estoque inicial
              <input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} />
            </label>
          ) : null}
          <label>
            Estoque mínimo
            <input type="number" min="0" step="1" value={form.minimumStock} onChange={set("minimumStock")} />
          </label>
          <label>
            Valor unitário
            <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={set("unitPrice")} />
          </label>
          <label>
            Unidade
            <input value={form.unit || "un"} onChange={set("unit")} />
          </label>
          <label className="wide">
            Observações
            <textarea rows="3" value={form.notes || ""} onChange={set("notes")} />
          </label>
        </div>
        <footer>
          <button type="button" className="secondary-action" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-action" disabled={saving}>
            {saving ? "Salvando..." : "Salvar peça"}
          </button>
        </footer>
      </form>
    </div>
  );
}
