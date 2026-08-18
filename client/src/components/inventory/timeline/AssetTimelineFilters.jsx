import { RefreshCw, Search } from "lucide-react";
import { CATEGORY_OPTIONS, PERIOD_OPTIONS } from "./assetTimelineModel.js";

export default function AssetTimelineFilters({
  category,
  onCategoryChange,
  period,
  onPeriodChange,
  queryText,
  onQueryTextChange,
  onlyImportant,
  onToggleOnlyImportant,
  onRefresh,
  refreshing
}) {
  return (
    <div className="asset-timeline-filters">
      <div className="asset-timeline-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Buscar no histórico..."
          value={queryText}
          onChange={(event) => onQueryTextChange(event.target.value)}
        />
      </div>

      <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select value={period} onChange={(event) => onPeriodChange(event.target.value)}>
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="asset-timeline-toggle">
        <input
          type="checkbox"
          checked={onlyImportant}
          onChange={(event) => onToggleOnlyImportant(event.target.checked)}
        />
        Só importantes
      </label>

      <button
        type="button"
        className="icon-button"
        onClick={onRefresh}
        disabled={refreshing}
        title="Atualizar"
      >
        <RefreshCw size={14} className={refreshing ? "spinning" : ""} />
      </button>
    </div>
  );
}
