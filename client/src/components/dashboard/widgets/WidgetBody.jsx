import { RefreshCw } from "lucide-react";
import { useWidgetData } from "../../../hooks/useWidgetData.js";
import { useDashboardFilters } from "./DashboardFilterContext.jsx";
import { widgetRegistry } from "./widgetRegistry.js";

export default function WidgetBody({ token, widget, ignoreDashboardFilters = false }) {
  const entry = widgetRegistry[widget.type];
  const { requestFilters, pending } = useDashboardFilters();
  const filters = ignoreDashboardFilters ? {} : requestFilters;
  const config = { ...widget.config, ...(filters.assetId ? { assetId: filters.assetId } : {}) };
  const needsAsset = Boolean(entry?.requiresAssetConfig && !config.assetId);
  const { data, loading, error } = useWidgetData({
    token, type: widget.type, config: widget.config, filters,
    refreshIntervalSeconds: widget.refreshIntervalSeconds,
    enabled: Boolean(entry) && !needsAsset
  });

  if (!entry) return <p className="dashboard-widget-error">Tipo de widget desconhecido: {widget.type}</p>;
  if (needsAsset) return <p className="dashboard-empty-state">Configure um ativo ou selecione uma máquina em outro gráfico.</p>;

  if ((!ignoreDashboardFilters && pending) || (loading && !data)) {
    return <div className="dashboard-widget-loading" role="status"><RefreshCw size={18} className="spin" /><span>Atualizando dados…</span></div>;
  }
  if (error && !data) return <p className="dashboard-widget-error" role="alert">{error}</p>;
  if (!data) return <p className="dashboard-empty-state">Sem dados no momento.</p>;
  if (data.warnings?.includes("filtered_out")) return <p className="dashboard-empty-state">Este ativo não corresponde aos filtros. Remova um filtro para ampliar a análise.</p>;

  const Component = entry.Component;
  return (
    <div className="dashboard-widget-content" aria-busy={loading}>
      {error && <p className="dashboard-widget-error" role="alert">Falha ao atualizar: {error} Exibindo a última leitura deste recorte.</p>}
      <Component data={data} config={config} />
      {data.warnings?.includes("recent_window_only") && <small className="dashboard-widget-caption">Recorte por ativo nos registros recentes; não inclui todo o histórico.</small>}
    </div>
  );
}
