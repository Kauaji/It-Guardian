import { Plus, Save, Trash2, X } from "lucide-react";

/**
 * Secoes do editor de conexao do Mapa Visual: campos de estilo, pontos manuais,
 * metadados eletricos e acoes. Todas desabilitam a edicao sem `canManage`.
 */

const METADATA_FIELDS = [
  { key: "circuit", label: "Circuito" },
  { key: "voltage", label: "Tensão" },
  { key: "panel", label: "Quadro" },
  { key: "breaker", label: "Disjuntor" },
  { key: "criticality", label: "Criticidade" },
  { key: "note", label: "Nota" }
];

export function ConnectionStyleFields({ draft, canManage, typeOptions, onChange }) {
  return (
    <div className="inventory-visual-form-grid compact">
      <label>
        Camada
        <select value={draft.layer} onChange={(event) => onChange("layer", event.target.value)} disabled={!canManage}>
          <option value="infrastructure">Infraestrutura</option>
          <option value="electrical">Elétrica</option>
        </select>
      </label>
      <label>
        Tipo
        <select value={draft.connectionType} onChange={(event) => onChange("connectionType", event.target.value)} disabled={!canManage}>
          {typeOptions.map((option) => (
            <option key={option.type} value={option.type}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Identificacao
        <input
          value={draft.label || ""}
          onChange={(event) => onChange("label", event.target.value)}
          disabled={!canManage}
          placeholder="Ex: Cabo rack A"
        />
      </label>
      <label>
        Cor
        <input
          type="color"
          value={draft.color || "#0ea5e9"}
          onChange={(event) => onChange("color", event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label>
        Espessura
        <input
          type="number"
          min="1"
          max="12"
          value={draft.thickness || 2}
          onChange={(event) => onChange("thickness", event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="inventory-visual-inline-check">
        <input
          type="checkbox"
          checked={!!draft.dashed}
          onChange={(event) => onChange("dashed", event.target.checked)}
          disabled={!canManage}
        />
        Tracejada
      </label>
    </div>
  );
}

function PointCoordinateInput({ axis, index, point, canManage, onPointChange }) {
  return (
    <input
      type="number"
      step="0.1"
      value={point[axis]}
      onChange={(event) => onPointChange(index, axis, event.target.value)}
      disabled={!canManage}
      aria-label={`Ponto ${index + 1} ${axis.toUpperCase()}`}
    />
  );
}

export function ConnectionPointList({ draft, canManage, saving, onPointChange, onAddPoint, onRemovePoint }) {
  return (
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
        <div className="inventory-visual-point-row" key={index}>
          <span>{index + 1}</span>
          {["x", "y", "z"].map((axis) => (
            <PointCoordinateInput key={axis} axis={axis} index={index} point={point} canManage={canManage} onPointChange={onPointChange} />
          ))}
          {canManage && (
            <button
              type="button"
              className="icon-button"
              onClick={() => onRemovePoint(index)}
              disabled={(draft.points || []).length <= 2 || saving}
              title="Remover ponto"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ConnectionMetadataFields({ draft, canManage, onMetadataChange }) {
  return (
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
  );
}

export function ConnectionEditorActions({ saving, onSave, onDelete, onCancel }) {
  return (
    <footer>
      <button type="button" className="primary-action compact-action" onClick={onSave} disabled={saving}>
        <Save size={15} />
        Salvar conexão
      </button>
      <button type="button" className="danger-action compact-action" onClick={onDelete} disabled={saving}>
        <Trash2 size={15} />
        Remover
      </button>
      <button type="button" className="secondary-action compact-action" onClick={onCancel} disabled={saving}>
        Cancelar
      </button>
    </footer>
  );
}
