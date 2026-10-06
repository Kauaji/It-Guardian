import {
  ConnectionEditorActions,
  ConnectionMetadataFields,
  ConnectionPointList,
  ConnectionStyleFields
} from "./visualMap/ConnectionEditorSections.jsx";
import { CONNECTION_TYPE_OPTIONS } from "./inventoryVisualMapConnectionUtils.js";

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
      <div className="inventory-visual-section-title">Editar conexão</div>

      <ConnectionStyleFields draft={draft} canManage={canManage} typeOptions={typeOptions} onChange={onChange} />

      <ConnectionPointList
        draft={draft}
        canManage={canManage}
        saving={saving}
        onPointChange={onPointChange}
        onAddPoint={onAddPoint}
        onRemovePoint={onRemovePoint}
      />

      <ConnectionMetadataFields draft={draft} canManage={canManage} onMetadataChange={onMetadataChange} />

      <label>
        Notas
        <textarea value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} disabled={!canManage} rows={2} />
      </label>

      {canManage && <ConnectionEditorActions saving={saving} onSave={onSave} onDelete={onDelete} onCancel={onCancel} />}
    </section>
  );
}
