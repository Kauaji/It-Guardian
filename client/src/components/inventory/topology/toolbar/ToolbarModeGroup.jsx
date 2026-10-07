import { Crosshair, Eye, Link2, Pencil } from "lucide-react";

export default function ToolbarModeGroup({
  editMode,
  canManage,
  canLink,
  creatingLink,
  layoutBusy,
  linkDraftActive,
  linkDraftSourceNodeId,
  linkActionAvailable,
  linkItemLabel,
  onToggleEditMode,
  onToggleLinkDraft,
  onCenterView
}) {
  return (
    <div className="network-topology-toolbar-group">
      <button
        type="button"
        className={`network-topology-toolbar-button ${editMode ? "is-active" : ""}`}
        onClick={onToggleEditMode}
        disabled={(!canManage && !canLink) || creatingLink || layoutBusy}
        title={editMode ? "Voltar para modo visualização" : "Entrar em modo edição"}
      >
        {editMode ? <Pencil size={15} /> : <Eye size={15} />}
        {editMode ? "Editando" : "Visualizando"}
      </button>
      {canLink ? (
        <button
          type="button"
          className={`network-topology-toolbar-button is-link-action ${linkDraftActive ? "is-active" : ""}`}
          onClick={onToggleLinkDraft}
          disabled={!linkActionAvailable || creatingLink || layoutBusy}
          aria-pressed={linkDraftActive}
          title={
            !linkActionAvailable
              ? `É preciso ter pelo menos dois ${linkItemLabel} neste mapa`
              : linkDraftActive
                ? "Cancelar conexão"
                : `Criar conexão manual entre dois ${linkItemLabel}`
          }
        >
          <Link2 size={15} />
          {creatingLink
            ? "Salvando conexão…"
            : linkDraftActive
              ? linkDraftSourceNodeId
                ? "Escolha o destino"
                : "Escolha a origem"
              : `Conectar ${linkItemLabel}`}
        </button>
      ) : null}
      <button type="button" className="network-topology-toolbar-button" onClick={onCenterView} title="Centralizar">
        <Crosshair size={15} />
      </button>
    </div>
  );
}
