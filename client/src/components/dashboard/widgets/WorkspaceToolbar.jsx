import { Grid3x3, Move, Pencil, Plus, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { formatDateTime } from "../dashboardFormatters.js";

function ViewActions({ canCustomize, onRefresh, onEdit }) {
  return (
    <>
      <button type="button" className="secondary-action" onClick={onRefresh}>
        <RefreshCw size={16} /> Atualizar agora
      </button>
      {canCustomize && (
        <button type="button" className="primary-action" onClick={onEdit}>
          <Pencil size={16} /> Editar dashboard
        </button>
      )}
    </>
  );
}

function EditActions({ workspace }) {
  const { arranging, saving } = workspace;
  return (
    <>
      <button type="button" className="secondary-action" onClick={() => workspace.setCatalogOpen(true)}>
        <Plus size={16} /> Adicionar widget
      </button>
      <button
        type="button"
        className={`secondary-action dashboard-arrange-toggle ${arranging ? "active" : ""}`}
        aria-pressed={arranging}
        onClick={() => workspace.setArranging((current) => !current)}
      >
        <Move size={16} /> {arranging ? "Finalizar organização" : "Organizar posições"}
      </button>
      <button type="button" className="secondary-action" onClick={workspace.restoreDefault} disabled={saving}>
        <RotateCcw size={16} /> Restaurar padrao
      </button>
      <button type="button" className="secondary-action" onClick={workspace.cancelEditing} disabled={saving}>
        <X size={16} /> Cancelar
      </button>
      <button type="button" className="primary-action" onClick={workspace.persistDraft} disabled={saving}>
        <Save size={16} /> {saving ? "Salvando..." : "Salvar layout"}
      </button>
    </>
  );
}

export default function WorkspaceToolbar({ workspace, canCustomize, onRefresh }) {
  return (
    <div className="dashboard-workspace-toolbar">
      <span className="dashboard-workspace-status">
        <Grid3x3 size={16} /> {workspace.activeWidgets.length} widget(s)
        {workspace.lastLoadedAt && ` - atualizado ${formatDateTime(workspace.lastLoadedAt)}`}
      </span>
      <div className="dashboard-workspace-actions">
        {!workspace.editing ? (
          <ViewActions canCustomize={canCustomize} onRefresh={onRefresh} onEdit={workspace.enterEditMode} />
        ) : (
          <EditActions workspace={workspace} />
        )}
      </div>
    </div>
  );
}
