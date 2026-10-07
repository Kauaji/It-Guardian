import { useState } from "react";
import { useDashboardLayout } from "../../../hooks/useDashboardLayout.js";
import DashboardWidgetConfigModal from "./DashboardWidgetConfigModal.jsx";
import { DashboardFilterBar, DashboardFilterProvider } from "./DashboardFilterContext.jsx";
import WidgetCatalogPanel from "./catalog/WidgetCatalogPanel.jsx";
import WidgetGrid from "./WidgetGrid.jsx";
import WorkspaceToolbar from "./WorkspaceToolbar.jsx";
import { MAX_WIDGETS } from "./workspaceModel.js";
import { useWorkspaceDraft } from "./useWorkspaceDraft.js";
import "./dashboardAnalytics.css";

/**
 * Orquestrador do dashboard configuravel: modo edicao opera sobre uma copia
 * local (draft) dos widgets, so persistida em "Salvar" -- "Cancelar" so
 * descarta o draft, nunca chama a API. Fora do modo edicao, renderiza
 * direto do layout salvo (view-only, mas os widgets continuam se
 * atualizando sozinhos via useWidgetData).
 */
export default function DashboardWorkspace({ token, canCustomize, notify }) {
  const { layout, loading, error, saveLayout, resetLayout } = useDashboardLayout({ token, canView: true, notify });
  const workspace = useWorkspaceDraft({ layout, saveLayout, resetLayout, notify });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { editing, arranging, draftWidgets, configuringWidget } = workspace;

  if (loading) {
    return <p className="dashboard-empty-state">Carregando dashboard...</p>;
  }

  if (error && !layout) {
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <DashboardFilterProvider key={token} enabled={!editing}>
      <div className="dashboard-workspace">
        <WorkspaceToolbar workspace={workspace} canCustomize={canCustomize} onRefresh={() => setRefreshNonce((value) => value + 1)} />

        <DashboardFilterBar />
        {editing && arranging ? (
          <p className="dashboard-arrange-hint" role="status">
            Arraste cada gráfico pela alça pontilhada. A nova ordem só é aplicada ao salvar o layout.
          </p>
        ) : null}
        <WidgetGrid
          key={refreshNonce}
          token={token}
          widgets={workspace.activeWidgets}
          editing={editing}
          arranging={arranging}
          onReorder={workspace.setDraftWidgets}
          onRemove={workspace.removeWidget}
          onResize={workspace.resizeWidget}
          onConfigure={workspace.setConfiguringWidget}
        />

        <WidgetCatalogPanel
          token={token}
          open={workspace.catalogOpen}
          onClose={() => workspace.setCatalogOpen(false)}
          onAddWidget={workspace.addWidgetFromCatalog}
          remainingSlots={Math.max(0, MAX_WIDGETS - draftWidgets.length)}
        />
        {configuringWidget && (
          <DashboardWidgetConfigModal
            token={token}
            widget={configuringWidget}
            onSave={workspace.saveWidgetConfig}
            onClose={() => workspace.setConfiguringWidget(null)}
          />
        )}
      </div>
    </DashboardFilterProvider>
  );
}
