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
import { formatPercentage } from "./widgetVisualizations.js";

/**
 * ATENCAO: o ResponsiveContainer (via WidgetChartFrame) clona o filho direto injetando width/height e, so quando o
 * nome do tipo termina em "Chart", tambem o style de 100%. Por isso estes wrappers terminam em "Chart" e repassam
 * todas as props recebidas ao grafico do recharts.
 *
 * Graficos recharts do WidgetCategoryChart (pizza/rosca, radial e colunas) e a legenda acessivel.
 * Pizza/radial sao decorativos (aria-hidden no wrapper, accessibilityLayer={false}); a legenda traz os dados.
 */

export function CategoryPieChart({ model, variant, ...chartProps }) {
  const { entries, selectable, selected, activate, formatValue, showPercentages, total } = model;
  return (
    <PieChart accessibilityLayer={false} {...chartProps}>
      <Pie
        data={entries}
        dataKey="value"
        nameKey="label"
        innerRadius={variant === "donut" ? "58%" : 0}
        outerRadius="90%"
        paddingAngle={1}
        isAnimationActive={false}
        onClick={(row) => selectable && activate(row)}
        cursor={selectable ? "pointer" : "default"}
      >
        {entries.map((row) => (
          <Cell
            key={row.id ?? row.label}
            fill={row.color}
            stroke={selected(row) ? "var(--text-strong)" : "var(--surface)"}
            strokeWidth={selected(row) ? 3 : 1}
          />
        ))}
      </Pie>
      <Tooltip
        formatter={(value) => (showPercentages ? formatValue(value) + " · " + formatPercentage(value, total) : formatValue(value))}
      />
    </PieChart>
  );
}

export function CategoryRadialChart({ model, ...chartProps }) {
  const { entries, selectable, selected, activate, formatValue } = model;
  return (
    <RadialBarChart
      accessibilityLayer={false}
      data={entries}
      innerRadius="24%"
      outerRadius="92%"
      startAngle={90}
      endAngle={-270}
      barSize={12}
      {...chartProps}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar
        dataKey="value"
        background={{ fill: "var(--surface-muted)" }}
        cornerRadius={6}
        isAnimationActive={false}
        onClick={(row) => selectable && activate(row)}
        cursor={selectable ? "pointer" : "default"}
      >
        {entries.map((row) => (
          <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />
        ))}
      </RadialBar>
      <Tooltip formatter={(value) => formatValue(value)} />
    </RadialBarChart>
  );
}

export function CategoryColumnsChart({ model, ...chartProps }) {
  const { entries, suffix, selectable, selected, activate, formatValue } = model;
  return (
    <BarChart data={entries} margin={{ top: 22, right: 8, bottom: 0, left: -22 }} accessibilityLayer {...chartProps}>
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
        domain={suffix === "%" ? [0, 100] : [0, "auto"]}
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--text-soft)", fontSize: 10 }}
      />
      <Tooltip formatter={(value) => formatValue(value)} cursor={{ fill: "var(--surface-muted)" }} />
      <Bar
        dataKey="value"
        maxBarSize={46}
        radius={[4, 4, 0, 0]}
        isAnimationActive={false}
        onClick={(row) => selectable && activate(row)}
        cursor={selectable ? "pointer" : "default"}
      >
        {entries.map((row) => (
          <Cell key={row.id ?? row.label} fill={row.color} stroke={selected(row) ? "var(--text-strong)" : "none"} strokeWidth={2} />
        ))}
        <LabelList dataKey="value" position="top" formatter={formatValue} className="dashboard-column-value" />
      </Bar>
    </BarChart>
  );
}

export function CategoryLegend({ model }) {
  const { entries, selectable, selected, activate, formatValue, label, showPercentages, percentage, percentageDescription } = model;
  return (
    <ul className="dashboard-chart-legend" aria-label="Dados do gráfico">
      {entries.map((row) => (
        <li key={row.id ?? row.label}>
          <button
            type="button"
            disabled={!selectable || row.id == null}
            aria-label={label(row)}
            aria-description={percentageDescription(row)}
            aria-pressed={selected(row)}
            onClick={() => activate(row)}
          >
            <i style={{ background: row.color }} aria-hidden="true" />
            <span title={row.label}>{row.label}</span>
            <span className="dashboard-chart-value">
              <strong>{formatValue(row.value)}</strong>
              {showPercentages && <small className="dashboard-chart-percentage">{percentage(row)}</small>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
