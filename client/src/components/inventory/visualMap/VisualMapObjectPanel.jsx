import { MousePointer2 } from "lucide-react";
import InventoryVisualMapConnectionEditor from "../InventoryVisualMapConnectionEditor.jsx";
import InventoryVisualMapConnectionPanel from "../InventoryVisualMapConnectionPanel.jsx";
import VisualMapObjectDetails from "./VisualMapObjectDetails.jsx";
import { layerLabel } from "./visualMapDrafts.js";

function PanelHeader({ layer, title, onClear }) {
  return (
    <header>
      <div>
        <span>{layerLabel(layer)}</span>
        <strong>{title}</strong>
      </div>
      <button type="button" className="icon-button" onClick={onClear} title="Limpar seleção">
        <MousePointer2 size={16} />
      </button>
    </header>
  );
}

function ConnectionSection({ connection, draft, mode, isEditing, saving, actions, onClear }) {
  return (
    <>
      <PanelHeader layer={connection.layer} title={connection.label || "Conexão sem identificação"} onClear={onClear} />
      <InventoryVisualMapConnectionPanel connection={connection} />
      {mode === "edit" && (
        <InventoryVisualMapConnectionEditor
          draft={draft}
          canManage={isEditing}
          saving={saving}
          onChange={actions.onChange}
          onPointChange={actions.onPointChange}
          onAddPoint={actions.onAddPoint}
          onRemovePoint={actions.onRemovePoint}
          onMetadataChange={actions.onMetadataChange}
          onSave={actions.onSave}
          onDelete={actions.onDelete}
          onCancel={actions.onCancel}
        />
      )}
    </>
  );
}

function EmptySelection() {
  return (
    <div className="inventory-visual-object-empty">
      <MousePointer2 size={22} />
      <strong>Selecione um objeto ou conexão no mapa.</strong>
      <span>No modo editar, use o painel lateral para inserir estrutura, ativos, infraestrutura ou elétrica.</span>
    </div>
  );
}

// Painel inferior: detalhes da conexao, do objeto selecionado ou o vazio.
export default function VisualMapObjectPanel({
  mode,
  isEditing,
  saving,
  devices,
  usedAssetIds,
  selectedObject,
  selectedConnection,
  objectDraft,
  connectionDraft,
  linkedDevice,
  linkedDeviceMeta,
  objectDirty,
  objectActions,
  connectionActions,
  onClearObject,
  onClearConnection
}) {
  let content = <EmptySelection />;
  if (selectedConnection && connectionDraft) {
    content = (
      <ConnectionSection
        connection={selectedConnection}
        draft={connectionDraft}
        mode={mode}
        isEditing={isEditing}
        saving={saving}
        actions={connectionActions}
        onClear={onClearConnection}
      />
    );
  } else if (selectedObject && objectDraft) {
    content = (
      <>
        <PanelHeader layer={selectedObject.layer} title={selectedObject.label} onClear={onClearObject} />
        <VisualMapObjectDetails
          draft={objectDraft}
          selectedObject={selectedObject}
          devices={devices}
          usedAssetIds={usedAssetIds}
          linkedDevice={linkedDevice}
          linkedDeviceMeta={linkedDeviceMeta}
          isEditing={isEditing}
          saving={saving}
          objectDirty={objectDirty}
          {...objectActions}
        />
      </>
    );
  }
  return <section className="inventory-visual-object-panel">{content}</section>;
}
