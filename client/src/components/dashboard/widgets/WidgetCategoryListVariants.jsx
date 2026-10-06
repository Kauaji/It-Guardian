/**
 * Variantes de lista do WidgetCategoryChart (sem recharts): estatisticas, barras/lista e mapa de calor.
 * Todas recebem o `model` de buildCategoryChartModel.
 */

function PercentageBadge({ model, row }) {
  return model.showPercentages ? <small className="dashboard-chart-percentage">{model.percentage(row)}</small> : null;
}

export function CategoryStatsVariant({ model }) {
  const { entries, selectable, selected, activate, formatValue, label, percentageDescription } = model;
  return (
    <dl className="dashboard-widget-stat-grid dashboard-category-stats">
      {entries.map((row) => (
        <div key={row.id ?? row.label}>
          <dt>{row.label}</dt>
          <dd>
            <button
              type="button"
              disabled={!selectable || row.id == null}
              aria-label={label(row)}
              aria-description={percentageDescription(row)}
              aria-pressed={selected(row)}
              onClick={() => activate(row)}
              style={{ color: row.color }}
            >
              <span>{formatValue(row.value)}</span>
              <PercentageBadge model={model} row={row} />
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CategoryBarsVariant({ model, variant }) {
  const { entries, selectable, selected, activate, formatValue, label, percentageDescription } = model;
  const max = Math.max(...entries.map((row) => row.value), 1);
  return (
    <ul className="dashboard-analytic-bars">
      {entries.map((row) => (
        <li key={row.id ?? row.label}>
          <button
            type="button"
            className="dashboard-chart-selection"
            disabled={!selectable || row.id == null}
            aria-label={label(row)}
            aria-description={percentageDescription(row)}
            aria-pressed={selected(row)}
            onClick={() => activate(row)}
          >
            <span className="dashboard-bar-heading">
              <span title={row.label}>{row.label}</span>
              <span className="dashboard-chart-value">
                <strong>{formatValue(row.value)}</strong>
                <PercentageBadge model={model} row={row} />
              </span>
            </span>
            {variant !== "list" && (
              <span className="dashboard-analytic-track">
                <span style={{ width: (row.value / max) * 100 + "%", background: row.color }} />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CategoryHeatmapVariant({ model }) {
  const { entries, suffix, entriesTotal, selectable, selected, activate, formatValue, label } = model;
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
              style={{ "--heat-color": row.color, "--heat-intensity": 8 + ratio * 0.24 + "%" }}
            >
              <span title={row.label}>{row.label}</span>
              <strong>{formatValue(row.value)}</strong>
              <span className="dashboard-heatmap-scale" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((cell) => (
                  <i key={cell} className={cell <= activeCells ? "active" : ""} />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
