import { useState } from "react";
import useVisualMapData from "./visualMap/useVisualMapData.js";
import useVisualMapDrafts from "./visualMap/useVisualMapDrafts.js";
import useVisualMapNavigation from "./visualMap/useVisualMapNavigation.js";
import {
  useVisualMapConnectionActions,
  useVisualMapMapActions,
  useVisualMapObjectActions
} from "./visualMap/useVisualMapActions.js";
import VisualMapCameraActions from "./visualMap/VisualMapCameraActions.jsx";
import VisualMapEmptyState from "./visualMap/VisualMapEmptyState.jsx";
import VisualMapHeader from "./visualMap/VisualMapHeader.jsx";
import VisualMapObjectPanel from "./visualMap/VisualMapObjectPanel.jsx";
import VisualMapSidebar from "./visualMap/VisualMapSidebar.jsx";
import InventoryVisualMapScene from "./InventoryVisualMapScene.jsx";

export default function InventoryVisualMapView({
  token,
  notify,
  devices = [],
  segments = [],
  groups = [],
  tabs = [],
  activeTab,
  canManage
}) {
  const [assetToAdd, setAssetToAdd] = useState("");
  const data = useVisualMapData({ token, devices });
  const drafts = useVisualMapDrafts(data);
  const nav = useVisualMapNavigation({ canManage, data, drafts });
  const mapActions = useVisualMapMapActions({ token, notify, canManage, tabs, activeTab, data, confirmDiscardChanges: nav.confirmDiscardChanges });
  const objectActions = useVisualMapObjectActions({
    token, notify, canManage, devices, isEditing: nav.isEditing, data, drafts, assetToAdd, setAssetToAdd
  });
  const connectionActions = useVisualMapConnectionActions({ token, notify, canManage, data, drafts });
  const { maps, activeMap, activeMapOption, selectedObject, selectedConnection, loading, saving, error } = data;

  return (
    <section className="inventory-visual-map-view" aria-label="Mapa visual 3D do inventário">
      <VisualMapHeader
        title={activeMap?.name || activeMapOption?.name || "Sem mapa selecionado"}
        hasUnsavedChanges={drafts.hasUnsavedChanges}
        loading={loading}
        saving={saving}
        canManage={canManage}
        onRefresh={nav.handleRefresh}
        onCreateMap={mapActions.handleCreateMap}
      />

      {error && (
        <div className="inventory-visual-map-error">
          <strong>Falha no mapa visual</strong>
          <span>{error}</span>
        </div>
      )}

      {loading && !activeMap && <div className="inventory-visual-map-loading">Carregando mapa visual...</div>}

      {!loading && !maps.length && (
        <VisualMapEmptyState canManage={canManage} saving={saving} onCreateMap={mapActions.handleCreateMap} />
      )}

      {!!maps.length && (
        <div className="inventory-visual-map-shell">
          <VisualMapSidebar
            maps={maps}
            activeMapId={data.activeMapId}
            mode={nav.mode}
            canManage={canManage}
            isEditing={nav.isEditing}
            saving={saving}
            mapDraft={data.mapDraft}
            tabs={tabs}
            groups={groups}
            segments={segments}
            devices={devices}
            usedAssetIds={data.usedAssetIds}
            assetToAdd={assetToAdd}
            layers={nav.layers}
            onMapChange={nav.handleMapChange}
            onModeChange={nav.handleModeChange}
            onMapDraftChange={drafts.updateMapDraft}
            onToggleGrid={nav.toggleGrid}
            onSaveMap={mapActions.handleSaveMap}
            onDeleteMap={mapActions.handleDeleteMap}
            onLayersChange={nav.setLayers}
            onToggleLayer={nav.toggleLayer}
            onAssetToAddChange={setAssetToAdd}
            onAddObject={objectActions.handleAddObject}
            onAddAssetObject={objectActions.handleAddAssetObject}
            onAddConnection={connectionActions.handleAddConnection}
          />

          <main className="inventory-visual-map-main">
            <VisualMapCameraActions hasSelection={Boolean(data.selectedObjectId)} onAction={nav.runCameraAction} />
            <InventoryVisualMapScene
              map={activeMap}
              objects={data.objects}
              connections={data.connections}
              selectedObjectId={data.selectedObjectId}
              selectedConnectionId={data.selectedConnectionId}
              layers={nav.layers}
              showGrid={nav.showGrid}
              cameraAction={nav.cameraAction}
              onSelectObject={nav.handleSelectObject}
              onSelectConnection={nav.handleSelectConnection}
            />
            <VisualMapObjectPanel
              mode={nav.mode}
              isEditing={nav.isEditing}
              saving={saving}
              devices={devices}
              usedAssetIds={data.usedAssetIds}
              selectedObject={selectedObject}
              selectedConnection={selectedConnection}
              objectDraft={drafts.objectDraft}
              connectionDraft={drafts.connectionDraft}
              linkedDevice={data.linkedDevice}
              linkedDeviceMeta={data.linkedDeviceMeta}
              objectDirty={drafts.objectDirty}
              objectActions={{
                onChange: drafts.updateObjectDraft,
                onMetadataChange: drafts.updateObjectMetadata,
                onSave: objectActions.handleSaveObject,
                onDuplicate: objectActions.handleDuplicateObject,
                onCancel: drafts.resetObjectDraft,
                onDelete: objectActions.handleDeleteObject
              }}
              connectionActions={{
                onChange: drafts.updateConnectionDraft,
                onPointChange: drafts.updateConnectionPoint,
                onAddPoint: drafts.addConnectionPoint,
                onRemovePoint: drafts.removeConnectionPoint,
                onMetadataChange: drafts.updateConnectionMetadata,
                onSave: connectionActions.handleSaveConnection,
                onDelete: connectionActions.handleDeleteConnection,
                onCancel: drafts.resetConnectionDraft
              }}
              onClearObject={() => data.setSelectedObjectId(null)}
              onClearConnection={() => data.setSelectedConnectionId(null)}
            />
          </main>
        </div>
      )}
    </section>
  );
}
