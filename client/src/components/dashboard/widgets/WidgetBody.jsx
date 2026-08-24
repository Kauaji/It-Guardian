import { RefreshCw } from "lucide-react";
import { useWidgetData } from "../../../hooks/useWidgetData.js";
import { widgetRegistry } from "./widgetRegistry.js";

/**
 * Estados genericos (carregando/erro/tipo desconhecido) ficam aqui, uma
 * unica vez para os ~19 tipos de widget -- cada componente de tipo so
 * precisa tratar seu proprio "sem dado" especifico (ex.: "nenhum ativo
 * critico" vs "sem historico suficiente"), nao os estados de rede.
 */
export default function WidgetBody({ token, widget }) {
  const entry = widgetRegistry[widget.type];
  const { data, loading, error } = useWidgetData({
    token,
    type: widget.type,
    config: widget.config,
    refreshIntervalSeconds: widget.refreshIntervalSeconds
  });

  if (!entry) {
    return <p className="dashboard-widget-error">Tipo de widget desconhecido: {widget.type}</p>;
  }

  if (loading && !data) {
    return (
      <div className="dashboard-widget-loading" aria-hidden="true">
        <RefreshCw size={18} className="spin" />
      </div>
    );
  }

  if (error && !data) {
    return <p className="dashboard-widget-error">{error}</p>;
  }

  if (!data) {
    return <p className="dashboard-empty-state">Sem dados no momento.</p>;
  }

  const Component = entry.Component;
  return <Component data={data} config={widget.config || {}} />;
}
