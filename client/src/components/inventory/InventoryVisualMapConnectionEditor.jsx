import { Plus, Save, Trash2, X } from "lucide-react";
import { CONNECTION_TYPE_OPTIONS } from "./inventoryVisualMapConnectionUtils.js";

const METADATA_FIELDS = [
  { key: "circuit", label: "Circuito" },
  { key: "voltage", label: "Tensao" },
  { key: "panel", label: "Quadro" },
  { key: "breaker", label: "Disjuntor" },
  { key: "criticality", label: "Criticidade" },
  { key: "note", label: "Nota" }
];

export default function InventoryVisualMapConnectionEditor({
  draft,
  canManage,
  saving,
  onChange,
  onPointChange,
  onAddPoint,
  onRemovePoint,
  onMetadataChange,
  onSave,
  onDelete,
  onCancel
}) {
  if (!draft) return null;

  const typeOptions = CONNECTION_TYPE_OPTIONS.filter((option) => option.layer === draft.layer);

  return (
    <section className="inventory-visual-connection-editor">
      <div className="inventory-visual-section-title">
        Editar conexao
      </div>

      <div className="inventory-visual-form-grid compact">
        <label>
          Camada
          <select value={draft.layer} onChange={(event) => onChange("layer", event.target.value)} disabled={!canManage}>
            <option value="infrastructure">Infraestrutura</option>
            <option value="electrical">Eletrica</option>
          </select>
        </label>
        <label>
          Tipo
          <select value={draft.connectionType} onChange={(event) => onChange("connectionType", event.target.value)} disabled={!canManage}>
            {typeOptions.map((option) => (
              <option key={option.type} value={option.type}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Identificacao
          <input value={draft.label || ""} onChange={(event) => onChange("label", event.target.value)} disabled={!canManage} placeholder="Ex: Cabo rack A" />
        </label>
        <label>
          Cor
          <input type="color" value={draft.color || "#0ea5e9"} onChange={(event) => onChange("color", event.target.value)} disabled={!canManage} />
        </label>
        <label>
          Espessura
          <input type="number" min="1" max="12" value={draft.thickness || 2} onChange={(event) => onChange("thickness", event.target.value)} disabled={!canManage} />
        </label>
        <label className="inventory-visual-inline-check">
          <input type="checkbox" checked={!!draft.dashed} onChange={(event) => onChange("dashed", event.target.checked)} disabled={!canManage} />
          Tracejada
        </label>
      </div>

      <div className="inventory-visual-point-list">
        <div className="inventory-visual-section-title">
          Pontos manuais
          {canManage && (
            <button type="button" className="secondary-action compact-action" onClick={onAddPoint} disabled={saving}>
              <Plus size={14} />
              Ponto
            </button>
          )}
        </div>
        {(draft.points || []).map((point, index) => (
          <div className="inventory-visual-point-row" key={`${index}-${point.x}-${point.z}`}>
            <span>{index + 1}</span>
            <input type="number" step="0.1" value={point.x} onChange={(event) => onPointChange(index, "x", event.target.value)} disabled={!canManage} aria-label={`Ponto ${index + 1} X`} />
            <input type="number" step="0.1" value={point.y} onChange={(event) => onPointChange(index, "y", event.target.value)} disabled={!canManage} aria-label={`Ponto ${index + 1} Y`} />
            <input type="number" step="0.1" value={point.z} onChange={(event) => onPointChange(index, "z", event.target.value)} disabled={!canManage} aria-label={`Ponto ${index + 1} Z`} />
            {canManage && (
              <button type="button" className="icon-button" onClick={() => onRemovePoint(index)} disabled={(draft.points || []).length <= 2 || saving} title="Remover ponto">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="inventory-visual-form-grid compact">
        {METADATA_FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              value={draft.metadata?.[field.key] || ""}
              onChange={(event) => onMetadataChange(field.key, event.target.value)}
              disabled={!canManage}
            />
          </label>
        ))}
      </div>

      <label>
        Notas
        <textarea value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} disabled={!canManage} rows={2} />
      </label>

      {canManage && (
        <footer>
          <button type="button" className="primary-action compact-action" onClick={onSave} disabled={saving}>
            <Save size={15} />
            Salvar conexao
          </button>
          <button type="button" className="danger-action compact-action" onClick={onDelete} disabled={saving}>
            <Trash2 size={15} />
            Remover
          </button>
          <button type="button" className="secondary-action compact-action" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </footer>
      )}
    </section>
  );
}
