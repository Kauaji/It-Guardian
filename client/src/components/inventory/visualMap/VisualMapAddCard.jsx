import { Boxes, Cable, Plus, PlugZap } from "lucide-react";
import { ADD_PRESET_GROUPS } from "./visualMapPresets.js";
import { getDeviceName } from "./visualMapDevices.js";

export default function VisualMapAddCard({
  devices,
  usedAssetIds,
  assetToAdd,
  saving,
  onAssetToAddChange,
  onAddObject,
  onAddAssetObject,
  onAddConnection
}) {
  return (
    <section className="inventory-visual-map-card">
      <div className="inventory-visual-section-title">
        <Plus size={16} />
        Adicionar
      </div>
      {ADD_PRESET_GROUPS.map((group) => (
        <PresetGroup key={group.layer} group={group} saving={saving} onAddObject={onAddObject} />
      ))}
      <label>
        Vincular ativo real
        <select value={assetToAdd} onChange={(event) => onAssetToAddChange(event.target.value)}>
          <option value="">Selecionar ativo</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id} disabled={usedAssetIds.has(device.id)}>
              {getDeviceName(device)}
              {usedAssetIds.has(device.id) ? " (já posicionado)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="secondary-action compact-action" onClick={onAddAssetObject} disabled={!assetToAdd || saving}>
        <Boxes size={15} />
        Adicionar ativo
      </button>
      <div className="inventory-visual-connection-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={() => onAddConnection("infrastructure")}
          disabled={saving}
        >
          <Cable size={15} />
          Cabo/infra
        </button>
        <button type="button" className="secondary-action compact-action" onClick={() => onAddConnection("electrical")} disabled={saving}>
          <PlugZap size={15} />
          Energia
        </button>
      </div>
    </section>
  );
}

function PresetGroup({ group, saving, onAddObject }) {
  return (
    <>
      <strong className="inventory-visual-preset-heading">{group.heading}</strong>
      <div className="inventory-visual-preset-grid">
        {group.presets.map((preset) => (
          <button key={preset.type} type="button" onClick={() => onAddObject(preset.type, group.layer)} disabled={saving}>
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}
