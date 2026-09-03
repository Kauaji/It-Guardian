import { Grid3x3, Move, Pencil, Plus, RefreshCw, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";
import { useDashboardLayout } from "../../../hooks/useDashboardLayout.js";
import { formatDateTime } from "../dashboardFormatters.js";
import DashboardWidgetConfigModal from "./DashboardWidgetConfigModal.jsx";
import { DashboardFilterBar, DashboardFilterProvider } from "./DashboardFilterContext.jsx";
import WidgetCatalogPanel from "./catalog/WidgetCatalogPanel.jsx";
import { reindexWidgetPositions } from "./widgetGridMath.js";
import WidgetGrid from "./WidgetGrid.jsx";
import "./dashboardAnalytics.css";

const DEFAULT_SIZE = { w: "m", h: "s" };
const DEFAULT_REFRESH_SECONDS = 60;

function createWidgetId() {
  return `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Orquestrador do dashboard configuravel: modo edicao opera sobre uma copia
 * local (draft) dos widgets, so persistida em "Salvar" -- "Cancelar" so
 * descarta o draft, nunca chama a API. Fora do modo edicao, renderiza
 * direto do layout salvo (view-only, mas os widgets continuam se
 * atualizando sozinhos via useWidgetData).
 */
export default function DashboardWorkspace({ token, canCustomize, notify }) {
  const { layout, loading, error, saveLayout, resetLayout } = useDashboardLayout({ token, canView: true, notify });
  const [editing, setEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configuringWidget, setConfiguringWidget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [arranging, setArranging] = useState(false);

  const activeWidgets = editing ? draftWidgets : layout?.widgets || [];

  function enterEditMode() {
    setDraftWidgets(layout?.widgets || []);
    setEditing(true);
    setArranging(false);
  }

  function cancelEditing() {
    setEditing(false);
    setDraftWidgets([]);
    setArranging(false);
  }

  async function persistDraft() {
    setSaving(true);
    try {
      await saveLayout({ widgets: draftWidgets });
      setLastLoadedAt(new Date().toISOString());
      setEditing(false);
      setArranging(false);
      notify?.("Layout do dashboard salvo.", "ok");
    } catch (saveError) {
      notify?.(saveError.message || "Nao foi possivel salvar o layout.", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    setSaving(true);
    try {
      const result = await resetLayout();
      setDraftWidgets(result.widgets);
      setLastLoadedAt(new Date().toISOString());
      notify?.("Layout restaurado para o padrao.", "ok");
    } catch (resetError) {
      notify?.(resetError.message || "Nao foi possivel restaurar o layout padrao.", "danger");
    } finally {
      setSaving(false);
    }
  }

  function addWidgetFromCatalog(catalogItem) {
    const newWidget = {
      id: createWidgetId(),
      type: catalogItem.type,
      x: 0,
      y: draftWidgets.length,
      w: catalogItem.defaultSize?.w || DEFAULT_SIZE.w,
      h: catalogItem.defaultSize?.h || DEFAULT_SIZE.h,
      refreshIntervalSeconds: DEFAULT_REFRESH_SECONDS,
      config: catalogItem.config || {}
    };
    setDraftWidgets((current) => [...current, newWidget]);
    setCatalogOpen(false);
    if (catalogItem.requiresAssetConfig) setConfiguringWidget(newWidget);
  }

  function removeWidget(widgetId) {
    setDraftWidgets((current) => reindexWidgetPositions(current.filter((widget) => widget.id !== widgetId)));
  }

  function resizeWidget(widgetId, sizePatch) {
    setDraftWidgets((current) => current.map((widget) => (widget.id === widgetId ? { ...widget, ...sizePatch } : widget)));
  }

  function saveWidgetConfig(updatedWidget) {
    setDraftWidgets((current) => current.map((widget) => (widget.id === updatedWidget.id ? updatedWidget : widget)));
    setConfiguringWidget(null);
  }

  if (loading) {
    return <p className="dashboard-empty-state">Carregando dashboard...</p>;
  }

  if (error && !layout) {
    return <p className="form-error" role="alert">{error}</p>;
  }

  return (
    <DashboardFilterProvider key={token} enabled={!editing}>
    <div className="dashboard-workspace">
      <div className="dashboard-workspace-toolbar">
        <span className="dashboard-workspace-status">
          <Grid3x3 size={16} /> {activeWidgets.length} widget(s)
          {lastLoadedAt && ` - atualizado ${formatDateTime(lastLoadedAt)}`}
        </span>
        <div className="dashboard-workspace-actions">
          {!editing ? (
            <>
              <button type="button" className="secondary-action" onClick={() => setRefreshNonce((value) => value + 1)}>
                <RefreshCw size={16} /> Atualizar agora
              </button>
              {canCustomize && (
                <button type="button" className="primary-action" onClick={enterEditMode}>
                  <Pencil size={16} /> Editar dashboard
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="secondary-action" onClick={() => setCatalogOpen(true)}>
                <Plus size={16} /> Adicionar widget
              </button>
              <button
                type="button"
                className={`secondary-action dashboard-arrange-toggle ${arranging ? "active" : ""}`}
                aria-pressed={arranging}
                onClick={() => setArranging((current) => !current)}
              >
                <Move size={16} /> {arranging ? "Finalizar organização" : "Organizar posições"}
              </button>
              <button type="button" className="secondary-action" onClick={restoreDefault} disabled={saving}>
                <RotateCcw size={16} /> Restaurar padrao
              </button>
              <button type="button" className="secondary-action" onClick={cancelEditing} disabled={saving}>
                <X size={16} /> Cancelar
              </button>
              <button type="button" className="primary-action" onClick={persistDraft} disabled={saving}>
                <Save size={16} /> {saving ? "Salvando..." : "Salvar layout"}
              </button>
            </>
          )}
        </div>
      </div>

      <DashboardFilterBar />
      {editing && arranging ? (
        <p className="dashboard-arrange-hint" role="status">
          Arraste cada gráfico pela alça pontilhada. A nova ordem só é aplicada ao salvar o layout.
        </p>
      ) : null}
      <WidgetGrid
        key={refreshNonce}
        token={token}
        widgets={activeWidgets}
        editing={editing}
        arranging={arranging}
        onReorder={setDraftWidgets}
        onRemove={removeWidget}
        onResize={resizeWidget}
        onConfigure={setConfiguringWidget}
      />

      <WidgetCatalogPanel token={token} open={catalogOpen} onClose={() => setCatalogOpen(false)} onAddWidget={addWidgetFromCatalog} remainingSlots={Math.max(0, 30 - draftWidgets.length)} />
      {configuringWidget && (
        <DashboardWidgetConfigModal
          token={token}
          widget={configuringWidget}
          onSave={saveWidgetConfig}
          onClose={() => setConfiguringWidget(null)}
        />
      )}
    </div>
    </DashboardFilterProvider>
  );
}
