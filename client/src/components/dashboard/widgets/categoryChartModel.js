import { chartColors, formatPercentage } from "./widgetVisualizations.js";

/**
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

  return {
    entries,
    suffix,
    showPercentages,
    selectable,
    selected,
    activate,
    formatValue,
    label,
    entriesTotal,
    total,
    percentage,
    percentageDescription
  };
}
