import { Copy, Move3D, RotateCw, Save, Trash2 } from "lucide-react";
import { numberInputValue } from "./visualMapDrafts.js";
import { getDeviceName } from "./visualMapDevices.js";
import { METADATA_FIELDS, OBJECT_NUMBER_FIELDS } from "./visualMapPresets.js";

function ObjectFields({ draft, selectedObject, devices, usedAssetIds, isEditing, onChange }) {
  return (
    <div className="inventory-visual-form-grid compact">
      <label>
        Nome
        <input value={draft.label} onChange={(event) => onChange("label", event.target.value)} disabled={!isEditing} />
      </label>
      <label>
        Cor
        <input type="color" value={draft.color} onChange={(event) => onChange("color", event.target.value)} disabled={!isEditing} />
      </label>
      <label>
        Ativo vinculado
        <select value={draft.linkedAssetId || ""} onChange={(event) => onChange("linkedAssetId", event.target.value)} disabled={!isEditing}>
          <option value="">Não vinculado</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id} disabled={usedAssetIds.has(device.id) && device.id !== selectedObject.linkedAssetId}>
              {getDeviceName(device)}
              {usedAssetIds.has(device.id) && device.id !== selectedObject.linkedAssetId ? " (já posicionado)" : ""}
            </option>
          ))}
        </select>
      </label>
      {OBJECT_NUMBER_FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            type="number"
            step={field.step}
            min={field.min}
            value={draft[field.key]}
            onChange={(event) => onChange(field.key, event.target.value)}
            disabled={!isEditing}
          />
        </label>
      ))}
    </div>
  );
}

function NudgeRow({ draft, isEditing, onChange }) {
  const nudges = [
    { key: "x-", label: "X-", icon: Move3D, field: "positionX", delta: -0.5 },
    { key: "x+", label: "X+", icon: Move3D, field: "positionX", delta: 0.5 },
    { key: "z-", label: "Z-", icon: Move3D, field: "positionZ", delta: -0.5 },
    { key: "girar", label: "Girar", icon: RotateCw, field: "rotationY", delta: 15 }
  ];
  return (
    <div className="inventory-visual-nudge-row">
      {nudges.map(({ key, label, icon: Icon, field, delta }) => (
        <button key={key} type="button" onClick={() => onChange(field, numberInputValue(draft[field]) + delta)} disabled={!isEditing}>
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

function LinkedAssetInfo({ device, meta }) {
  return (
    <div className="inventory-visual-asset-info">
      <strong>{getDeviceName(device)}</strong>
      <span>Status: {meta.status}</span>
      <span>IP: {meta.ip}</span>
      <span>Sistema: {meta.os}</span>
      <span>Aba: {meta.environment}</span>
      <span>Grupo: {meta.group}</span>
      <span>Segmento: {meta.segment}</span>
    </div>
  );
}

function MetadataFields({ metadata, isEditing, onChange }) {
  return (
    <div className="inventory-visual-metadata-grid">
      {METADATA_FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <input value={metadata?.[field.key] || ""} onChange={(event) => onChange(field.key, event.target.value)} disabled={!isEditing} />
        </label>
      ))}
    </div>
  );
}

function ObjectFooter({ saving, objectDirty, onSave, onDuplicate, onCancel, onDelete }) {
  return (
    <footer>
      <button type="button" className="primary-action compact-action" onClick={onSave} disabled={saving}>
        <Save size={15} />
        Salvar objeto
      </button>
      <button type="button" className="secondary-action compact-action" onClick={onDuplicate} disabled={saving}>
        <Copy size={15} />
        Duplicar
      </button>
      <button type="button" className="secondary-action compact-action" onClick={onCancel} disabled={!objectDirty || saving}>
        Cancelar
      </button>
      <button type="button" className="danger-action compact-action" onClick={onDelete} disabled={saving}>
        <Trash2 size={15} />
        Remover
      </button>
    </footer>
  );
}

// Corpo do painel de um objeto selecionado (campos, ajustes, ativo vinculado e rodape).
export default function VisualMapObjectDetails({
  draft,
  selectedObject,
  devices,
  usedAssetIds,
  linkedDevice,
  linkedDeviceMeta,
  isEditing,
  saving,
  objectDirty,
  onChange,
  onMetadataChange,
  onSave,
  onDuplicate,
  onCancel,
  onDelete
}) {
  return (
    <>
      <ObjectFields
        draft={draft}
        selectedObject={selectedObject}
        devices={devices}
        usedAssetIds={usedAssetIds}
        isEditing={isEditing}
        onChange={onChange}
      />
      <NudgeRow draft={draft} isEditing={isEditing} onChange={onChange} />
      <label>
        Notas
        <textarea value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} disabled={!isEditing} rows={2} />
      </label>
      {linkedDevice && <LinkedAssetInfo device={linkedDevice} meta={linkedDeviceMeta} />}
      {["infrastructure", "electrical"].includes(selectedObject.layer) && (
        <MetadataFields metadata={draft.metadata} isEditing={isEditing} onChange={onMetadataChange} />
      )}
      {isEditing && (
        <ObjectFooter
          saving={saving}
          objectDirty={objectDirty}
          onSave={onSave}
          onDuplicate={onDuplicate}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
