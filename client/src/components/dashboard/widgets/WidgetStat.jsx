import { useDashboardFilters } from "./DashboardFilterContext.jsx";

export default function WidgetStat({ label, value, dimension, filterValue, filterLabel, tone = "" }) {
  const { filters, enabled, toggleFilter } = useDashboardFilters();
  const interactive = enabled && Boolean(dimension);
  return (
    <div className={"dashboard-widget-stat " + tone}>
      <dt>{label}</dt>
      <dd>{dimension ? (
        <button type="button" disabled={!interactive} aria-pressed={filters[dimension] === filterValue} aria-label={"Filtrar por " + label + ": " + (value ?? 0)} onClick={() => toggleFilter(dimension, filterValue, filterLabel || label)}>{value ?? 0}</button>
      ) : value ?? 0}</dd>
    </div>
  );
}
