import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardFilters } from "./DashboardFilterContext.jsx";
import WidgetChartFrame from "./WidgetChartFrame.jsx";
import { chartColors } from "./widgetVisualizations.js";

export default function WidgetCategoryChart({ rows = [], variant = "bars", dimension, emptyMessage, suffix = "" }) {
  const { filters, enabled, toggleFilter } = useDashboardFilters();
  const entries = rows.map((row, index) => ({ ...row, color: row.color || chartColors[index % chartColors.length] }));
  const selectable = enabled && Boolean(dimension);
  const selected = (row) => row.id != null && filters[dimension] === (row.filterValue ?? row.id);
  const activate = (row) => toggleFilter(dimension, row.filterValue ?? row.id, row.filterLabel || row.label);
  const formatValue = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + suffix;
  const label = (row) => "Filtrar por " + row.label + ": " + formatValue(row.value);

  if (!entries.length || (!suffix && !entries.some((row) => row.value > 0))) {
    return <p className="dashboard-empty-state">{emptyMessage || "Nenhum dado neste recorte. Remova um filtro para ampliar a análise."}</p>;
  }

  if (variant === "stats") {
    return (
      <dl className="dashboard-widget-stat-grid dashboard-category-stats">
        {entries.map((row) => (
          <div key={row.id ?? row.label}>
            <dt>{row.label}</dt>
            <dd><button type="button" disabled={!selectable || row.id == null} aria-label={label(row)} aria-pressed={selected(row)} onClick={() => activate(row)} style={{ color: row.color }}>{formatValue(row.value)}</button></dd>
          </div>
        ))}
      </dl>
    );
  }

  if (variant === "bars" || variant === "list") {
    const max = Math.max(...entries.map((row) => row.value), 1);
    return (
      <ul className="dashboard-analytic-bars">
        {entries.map((row) => (
          <li key={row.id ?? row.label}>
            <button type="button" className="dashboard-chart-selection" disabled={!selectable || row.id == null} aria-label={label(row)} aria-pressed={selected(row)} onClick={() => activate(row)}>
              <span className="dashboard-bar-heading"><span title={row.label}>{row.label}</span><strong>{formatValue(row.value)}</strong></span>
              {variant !== "list" && <span className="dashboard-analytic-track"><span style={{ width: (row.value / max * 100) + "%", background: row.color }} /></span>}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const isPie = variant === "pie" || variant === "donut";
  return (
    <div className={"dashboard-category-chart " + (isPie ? "circular" : "columns")}>
      <WidgetChartFrame>
        {isPie ? (
          <PieChart>
            <Pie data={entries} dataKey="value" nameKey="label" innerRadius={variant === "donut" ? "58%" : 0} outerRadius="90%" paddingAngle={1} isAnimationActive={false} onClick={(row) => selectable && activate(row)} cursor={selectable ? "pointer" : "default"}>
              {entries.map((row) => <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "var(--surface)"} strokeWidth={selected(row) ? 3 : 1} />)}
            </Pie>
            <Tooltip formatter={(value) => formatValue(value)} />
          </PieChart>
        ) : (
          <BarChart data={entries} margin={{ top: 8, right: 8, bottom: 0, left: -22 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} tickFormatter={(value) => value.length > 13 ? value.slice(0, 11) + "…" : value} />
            <YAxis allowDecimals={false} domain={suffix === "%" ? [0, 100] : [0, "auto"]} tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} />
            <Tooltip formatter={(value) => formatValue(value)} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="value" maxBarSize={46} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(row) => selectable && activate(row)} cursor={selectable ? "pointer" : "default"}>
              {entries.map((row) => <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />)}
            </Bar>
          </BarChart>
        )}
      </WidgetChartFrame>
      <ul className="dashboard-chart-legend" aria-label="Dados do gráfico">
        {entries.map((row) => (
          <li key={row.id ?? row.label}>
            <button type="button" disabled={!selectable || row.id == null} aria-label={label(row)} aria-pressed={selected(row)} onClick={() => activate(row)}>
              <i style={{ background: row.color }} aria-hidden="true" /><span title={row.label}>{row.label}</span><strong>{formatValue(row.value)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
