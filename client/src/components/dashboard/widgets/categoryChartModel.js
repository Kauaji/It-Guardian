import { chartColors, formatPercentage } from "./widgetVisualizations.js";

/**
 * `selectionProps(row, describe)`: atributos do botao de selecao (disabled, aria e onClick), na ordem do DOM original.
 * `chartClick`/`cursor`: clique e cursor das series do recharts.
 *
 * Estado derivado puro do WidgetCategoryChart: cores, selecao do filtro cruzado,
 * formatacao de valores e percentuais. Compartilhado por todas as variantes.
 */
export function buildCategoryChartModel({ rows, filters, enabled, toggleFilter, dimension, suffix, showPercentages, percentageTotal }) {
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
  const percentageDescription = (row) => (showPercentages ? percentage(row) + " do total" : undefined);

  const selectionProps = (row, describe = true) => ({
    disabled: !selectable || row.id == null,
    "aria-label": label(row),
    ...(describe ? { "aria-description": percentageDescription(row) } : {}),
    "aria-pressed": selected(row),
    onClick: () => activate(row)
  });
  const chartClick = (row) => selectable && activate(row);
  const cursor = selectable ? "pointer" : "default";

  return {
    entries,
    suffix,
    showPercentages,
    selected,
    formatValue,
    entriesTotal,
    total,
    percentage,
    selectionProps,
    chartClick,
    cursor
  };
}
