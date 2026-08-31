import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardFilters } from "./DashboardFilterContext.jsx";
import WidgetChartFrame from "./WidgetChartFrame.jsx";
import { chartColors, formatPercentage } from "./widgetVisualizations.js";

export default function WidgetCategoryChart({ rows = [], variant = "bars", dimension, emptyMessage, suffix = "", showPercentages = false, percentageTotal }) {
  const { filters, enabled, toggleFilter } = useDashboardFilters();
  const entries = rows.map((row, index) => ({ ...row, color: row.color || chartColors[index % chartColors.length] }));
  const selectable = enabled && Boolean(dimension);
  const selected = (row) => row.id != null && filters[dimension] === (row.filterValue ?? row.id);
  const activate = (row) => toggleFilter(dimension, row.filterValue ?? row.id, row.filterLabel || row.label);
  const formatValue = (value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + suffix;
  const label = (row) => "Filtrar por " + row.label + ": " + formatValue(row.value);
  const entriesTotal = entries.reduce((sum, row) => {
    const value = Number(row.value);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const total = Number.isFinite(Number(percentageTotal)) ? Number(percentageTotal) : entriesTotal;
  const percentage = (row) => formatPercentage(row.value, total);
  const percentageDescription = (row) => showPercentages ? percentage(row) + " do total" : undefined;

  if (!entries.length || (!suffix && !entries.some((row) => row.value > 0))) {
    return <p className="dashboard-empty-state">{emptyMessage || "Nenhum dado neste recorte. Remova um filtro para ampliar a análise."}</p>;
  }

  if (variant === "stats") {
    return (
      <dl className="dashboard-widget-stat-grid dashboard-category-stats">
        {entries.map((row) => (
          <div key={row.id ?? row.label}>
            <dt>{row.label}</dt>
            <dd><button type="button" disabled={!selectable || row.id == null} aria-label={label(row)} aria-description={percentageDescription(row)} aria-pressed={selected(row)} onClick={() => activate(row)} style={{ color: row.color }}><span>{formatValue(row.value)}</span>{showPercentages && <small className="dashboard-chart-percentage">{percentage(row)}</small>}</button></dd>
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
            <button type="button" className="dashboard-chart-selection" disabled={!selectable || row.id == null} aria-label={label(row)} aria-description={percentageDescription(row)} aria-pressed={selected(row)} onClick={() => activate(row)}>
              <span className="dashboard-bar-heading"><span title={row.label}>{row.label}</span><span className="dashboard-chart-value"><strong>{formatValue(row.value)}</strong>{showPercentages && <small className="dashboard-chart-percentage">{percentage(row)}</small>}</span></span>
              {variant !== "list" && <span className="dashboard-analytic-track"><span style={{ width: (row.value / max * 100) + "%", background: row.color }} /></span>}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "heatmap") {
    return (
      <ul className="dashboard-heatmap-grid" aria-label="Mapa de intensidade dos ativos">
        {entries.map((row) => {
          const value = Number(row.value);
          const ratio = Math.min(100, Math.max(0, suffix === "%" ? value : (value / Math.max(entriesTotal, 1)) * 100));
          const activeCells = Math.ceil(ratio / 20);
          return (
            <li key={row.id ?? row.label}>
              <button
                type="button"
                className="dashboard-heatmap-cell"
                disabled={!selectable || row.id == null}
                aria-label={label(row)}
                aria-pressed={selected(row)}
                onClick={() => activate(row)}
                style={{ "--heat-color": row.color, "--heat-intensity": (8 + ratio * .24) + "%" }}
              >
                <span title={row.label}>{row.label}</span>
                <strong>{formatValue(row.value)}</strong>
                <span className="dashboard-heatmap-scale" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((cell) => <i key={cell} className={cell <= activeCells ? "active" : ""} />)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const isPie = variant === "pie" || variant === "donut";
  const isRadial = variant === "radial";
  const legend = (
    <ul className="dashboard-chart-legend" aria-label="Dados do gráfico">
      {entries.map((row) => (
        <li key={row.id ?? row.label}>
          <button type="button" disabled={!selectable || row.id == null} aria-label={label(row)} aria-description={percentageDescription(row)} aria-pressed={selected(row)} onClick={() => activate(row)}>
            <i style={{ background: row.color }} aria-hidden="true" /><span title={row.label}>{row.label}</span><span className="dashboard-chart-value"><strong>{formatValue(row.value)}</strong>{showPercentages && <small className="dashboard-chart-percentage">{percentage(row)}</small>}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={"dashboard-category-chart " + (isPie ? "circular" : isRadial ? "radial" : "columns")}>
      <WidgetChartFrame>
        {isPie ? (
          <PieChart>
            <Pie data={entries} dataKey="value" nameKey="label" innerRadius={variant === "donut" ? "58%" : 0} outerRadius="90%" paddingAngle={1} isAnimationActive={false} onClick={(row) => selectable && activate(row)} cursor={selectable ? "pointer" : "default"}>
              {entries.map((row) => <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "var(--surface)"} strokeWidth={selected(row) ? 3 : 1} />)}
            </Pie>
            <Tooltip formatter={(value) => showPercentages ? formatValue(value) + " · " + formatPercentage(value, total) : formatValue(value)} />
          </PieChart>
        ) : isRadial ? (
          <RadialBarChart data={entries} innerRadius="24%" outerRadius="92%" startAngle={90} endAngle={-270} barSize={12}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: "var(--surface-muted)" }} cornerRadius={6} isAnimationActive={false} onClick={(row) => selectable && activate(row)} cursor={selectable ? "pointer" : "default"}>
              {entries.map((row) => <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />)}
            </RadialBar>
            <Tooltip formatter={(value) => formatValue(value)} />
          </RadialBarChart>
        ) : (
          <BarChart data={entries} margin={{ top: 22, right: 8, bottom: 0, left: -22 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} tickFormatter={(value) => value.length > 13 ? value.slice(0, 11) + "…" : value} />
            <YAxis allowDecimals={false} domain={suffix === "%" ? [0, 100] : [0, "auto"]} tickLine={false} axisLine={false} tick={{ fill: "var(--text-soft)", fontSize: 10 }} />
            <Tooltip formatter={(value) => formatValue(value)} cursor={{ fill: "var(--surface-muted)" }} />
            <Bar dataKey="value" maxBarSize={46} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={(row) => selectable && activate(row)} cursor={selectable ? "pointer" : "default"}>
              {entries.map((row) => <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />)}
              <LabelList dataKey="value" position="top" formatter={formatValue} className="dashboard-column-value" />
            </Bar>
          </BarChart>
        )}
      </WidgetChartFrame>
      {legend}
    </div>
  );
}
