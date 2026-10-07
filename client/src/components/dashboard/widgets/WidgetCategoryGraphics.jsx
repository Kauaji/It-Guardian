import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CategoryValue } from "./WidgetCategoryListVariants.jsx";
import { formatPercentage } from "./widgetVisualizations.js";

/**
 * Graficos recharts do WidgetCategoryChart (pizza/rosca, radial e colunas) e a legenda acessivel.
 * Pizza/radial sao decorativos (aria-hidden no wrapper, accessibilityLayer={false}); a legenda traz os dados.
 *
 * Os graficos sao funcoes que devolvem o elemento do recharts (nao componentes): o ResponsiveContainer
 * (via WidgetChartFrame) injeta width/height/style no filho direto, que precisa ser o proprio *Chart.
 */

/** Celulas coloridas com contorno quando selecionadas (funcao, nao componente: o recharts so detecta <Cell> filho direto). */
function selectionCells({ entries, selected }) {
  return entries.map((row) => (
    <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />
  ));
}

export function renderPieChart(model, variant) {
  const { entries } = model;
  return (
    <PieChart accessibilityLayer={false}>
      <Pie
        data={entries}
        dataKey="value"
        nameKey="label"
        innerRadius={variant === "donut" ? "58%" : 0}
        outerRadius="90%"
        paddingAngle={1}
        isAnimationActive={false}
        onClick={model.chartClick}
        cursor={model.cursor}
      >
        {entries.map((row) => (
          <Cell
            key={row.id ?? row.label}
            fill={row.color}
            stroke={model.selected(row) ? "var(--text-strong)" : "var(--surface)"}
            strokeWidth={model.selected(row) ? 3 : 1}
          />
        ))}
      </Pie>
      <Tooltip
        formatter={(value) =>
          model.showPercentages ? model.formatValue(value) + " · " + formatPercentage(value, model.total) : model.formatValue(value)
        }
      />
    </PieChart>
  );
}

export function renderRadialChart(model) {
  const { entries } = model;
  return (
    <RadialBarChart
      accessibilityLayer={false}
      data={entries}
      innerRadius="24%"
      outerRadius="92%"
      startAngle={90}
      endAngle={-270}
      barSize={12}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar
        dataKey="value"
        background={{ fill: "var(--surface-muted)" }}
        cornerRadius={6}
        isAnimationActive={false}
        onClick={model.chartClick}
        cursor={model.cursor}
      >
        {selectionCells(model)}
      </RadialBar>
      <Tooltip formatter={model.formatValue} />
    </RadialBarChart>
  );
}

export function renderColumnsChart(model) {
  const { entries } = model;
  return (
    <BarChart data={entries} margin={{ top: 22, right: 8, bottom: 0, left: -22 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--text-soft)", fontSize: 10 }}
        tickFormatter={(value) => (value.length > 13 ? value.slice(0, 11) + "…" : value)}
      />
      <YAxis
        allowDecimals={false}
        domain={model.suffix === "%" ? [0, 100] : [0, "auto"]}
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--text-soft)", fontSize: 10 }}
      />
      <Tooltip formatter={model.formatValue} cursor={{ fill: "var(--surface-muted)" }} />
      <Bar dataKey="value" maxBarSize={46} radius={[4, 4, 0, 0]} isAnimationActive={false} onClick={model.chartClick} cursor={model.cursor}>
        {selectionCells(model)}
        <LabelList dataKey="value" position="top" formatter={model.formatValue} className="dashboard-column-value" />
      </Bar>
    </BarChart>
  );
}

export function CategoryLegend({ model }) {
  const { entries } = model;
  return (
    <ul className="dashboard-chart-legend" aria-label="Dados do gráfico">
      {entries.map((row) => (
        <li key={row.id ?? row.label}>
          <button type="button" {...model.selectionProps(row)}>
            <i style={{ background: row.color }} aria-hidden="true" />
            <span title={row.label}>{row.label}</span>
            <CategoryValue model={model} row={row} />
          </button>
        </li>
      ))}
    </ul>
  );
}
