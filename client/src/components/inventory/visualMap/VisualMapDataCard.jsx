import { Building2, Grid2X2, Save, Trash2 } from "lucide-react";

function LinkSelect({ label, value, options, disabled, onChange }) {
  return (
    <label>
      {label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Não vinculado</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, disabled, onChange, ...inputProps }) {
  return (
    <label>
      {label}
      <input type="number" {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

export default function VisualMapDataCard({
  draft, tabs, groups, segments, isEditing, saving, onChange, onToggleGrid, onSave, onDelete
}) {
  return (
    <section className="inventory-visual-map-card">
      <div className="inventory-visual-section-title">
        <Building2 size={16} />
        Dados do mapa
      </div>
      <label>
        Nome
        <input value={draft.name} onChange={(event) => onChange("name", event.target.value)} disabled={!isEditing} />
      </label>
      <div className="inventory-visual-form-grid">
        <LinkSelect label="Aba" value={draft.environmentId} options={tabs} disabled={!isEditing} onChange={(value) => onChange("environmentId", value)} />
        <LinkSelect label="Grupo" value={draft.groupId} options={groups} disabled={!isEditing} onChange={(value) => onChange("groupId", value)} />
        <LinkSelect label="Segmento" value={draft.segmentId} options={segments} disabled={!isEditing} onChange={(value) => onChange("segmentId", value)} />
        <label>
          Andar
          <input value={draft.floorLabel || ""} onChange={(event) => onChange("floorLabel", event.target.value)} disabled={!isEditing} placeholder="Ex: 2o andar" />
        </label>
        <NumberField label="Largura" min="5" max="200" value={draft.width} disabled={!isEditing} onChange={(value) => onChange("width", value)} />
        <NumberField label="Profundidade" min="5" max="200" value={draft.depth} disabled={!isEditing} onChange={(value) => onChange("depth", value)} />
        <NumberField label="Escala da grade" min="0.1" max="10" step="0.1" value={draft.scale} disabled={!isEditing} onChange={(value) => onChange("scale", value)} />
      </div>
      <label>
        Observacoes
        <textarea value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} disabled={!isEditing} rows={3} />
      </label>
      <div className="inventory-visual-card-actions">
        <button type="button" className="secondary-action compact-action" onClick={onToggleGrid}>
          <Grid2X2 size={15} />
          Grade
        </button>
        {isEditing && (
          <>
            <button type="button" className="primary-action compact-action" onClick={onSave} disabled={saving}>
              <Save size={15} />
              Salvar
            </button>
            <button type="button" className="danger-action compact-action" onClick={onDelete} disabled={saving}>
              <Trash2 size={15} />
              Excluir
            </button>
          </>
        )}
      </div>
    </section>
  );
}
