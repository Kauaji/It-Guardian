import { ResponsiveContainer } from "recharts";
import { useSettledWidthKey } from "../../../hooks/useSettledWidthKey.js";

/**
 * Mesma logica de DashboardChartCard.jsx (skeleton/empty/ResponsiveContainer
 * com a chave settledWidthKey, que evita o grafico renderizar em branco no
 * primeiro paint) mas sem o <section>/panel-heading proprio -- o titulo ja
 * vem do WidgetChrome dentro de um widget.
 */
export default function WidgetChartFrame({ empty, emptyMessage, height, children }) {
  const settledWidthKey = useSettledWidthKey();

  if (empty) {
    return <p className="dashboard-empty-state">{emptyMessage || "Sem dados suficientes neste periodo."}</p>;
  }

  return (
    <div className="chart-box dashboard-widget-chart-frame" style={height ? { height } : undefined}>
      <ResponsiveContainer key={settledWidthKey} width="100%" height="100%" minWidth={0} debounce={80}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
