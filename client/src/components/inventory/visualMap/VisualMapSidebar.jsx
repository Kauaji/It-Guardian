import { Layers3, MousePointer2, Pencil } from "lucide-react";
import InventoryVisualMapLayerPresetBar from "../InventoryVisualMapLayerPresetBar.jsx";
import VisualMapAddCard from "./VisualMapAddCard.jsx";
import VisualMapDataCard from "./VisualMapDataCard.jsx";

export default function VisualMapSidebar({
  maps,
  activeMapId,
  mode,
  canManage,
  isEditing,
  saving,
  mapDraft,
  tabs,
  groups,
  segments,
  devices,
  usedAssetIds,
  assetToAdd,
  layers,
  onMapChange,
  onModeChange,
  onMapDraftChange,
  onToggleGrid,
  onSaveMap,
  onDeleteMap,
  onLayersChange,
  onToggleLayer,
  onAssetToAddChange,
  onAddObject,
  onAddAssetObject,
  onAddConnection
}) {
  return (
    <aside className="inventory-visual-map-sidebar">
      <label>
        Mapa
        <select value={activeMapId} onChange={(event) => onMapChange(event.target.value)}>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.objectCount || 0})
            </option>
          ))}
        </select>
      </label>

      <div className="inventory-visual-mode-toggle" role="group" aria-label="Modo do mapa">
        <button type="button" className={mode === "view" ? "active" : ""} onClick={() => onModeChange("view")}>
          <MousePointer2 size={16} />
          Visualizar
        </button>
        <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => onModeChange("edit")} disabled={!canManage}>
          <Pencil size={16} />
          Editar
        </button>
      </div>

      <VisualMapDataCard
        draft={mapDraft}
        tabs={tabs}
        groups={groups}
        segments={segments}
        isEditing={isEditing}
        saving={saving}
        onChange={onMapDraftChange}
        onToggleGrid={onToggleGrid}
        onSave={onSaveMap}
        onDelete={onDeleteMap}
      />

      <section className="inventory-visual-map-card">
        <div className="inventory-visual-section-title">
          <Layers3 size={16} />
          Camadas
        </div>
        <InventoryVisualMapLayerPresetBar layers={layers} onLayersChange={onLayersChange} onToggleLayer={onToggleLayer} />
      </section>

      {canManage && mode === "edit" && (
        <VisualMapAddCard
          devices={devices}
          usedAssetIds={usedAssetIds}
          assetToAdd={assetToAdd}
          saving={saving}
          onAssetToAddChange={onAssetToAddChange}
          onAddObject={onAddObject}
          onAddAssetObject={onAddAssetObject}
          onAddConnection={onAddConnection}
        />
      )}
    </aside>
  );
}
