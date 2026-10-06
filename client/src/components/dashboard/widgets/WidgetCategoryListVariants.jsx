/**
 * Variantes de lista do WidgetCategoryChart (sem recharts): estatisticas, barras/lista e mapa de calor.
 * Todas recebem o `model` de buildCategoryChartModel.
 */

/** Valor formatado + percentual opcional, compartilhado por barras/lista e pela legenda. */
export function CategoryValue({ model, row }) {
  return (
    <span className="dashboard-chart-value">
      <strong>{model.formatValue(row.value)}</strong>
      {model.showPercentages && <small className="dashboard-chart-percentage">{model.percentage(row)}</small>}
    </span>
  );
}

export function CategoryStatsVariant({ model }) {
  const { entries } = model;
  return (
    <dl className="dashboard-widget-stat-grid dashboard-category-stats">
      {entries.map((row) => (
        <div key={row.id ?? row.label}>
          <dt>{row.label}</dt>
          <dd>
            <button type="button" {...model.selectionProps(row)} style={{ color: row.color }}>
              <span>{model.formatValue(row.value)}</span>
              {model.showPercentages && <small className="dashboard-chart-percentage">{model.percentage(row)}</small>}
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CategoryBarsVariant({ model, variant }) {
  const { entries } = model;
  const max = Math.max(...entries.map((row) => row.value), 1);
  return (
    <ul className="dashboard-analytic-bars">
      {entries.map((row) => (
        <li key={row.id ?? row.label}>
          <button type="button" className="dashboard-chart-selection" {...model.selectionProps(row)}>
            <span className="dashboard-bar-heading">
              <span title={row.label}>{row.label}</span>
              <CategoryValue model={model} row={row} />
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
  const { entries } = model;
  return (
    <ul className="dashboard-heatmap-grid" aria-label="Mapa de intensidade dos ativos">
      {entries.map((row) => {
        const value = Number(row.value);
        const ratio = Math.min(100, Math.max(0, model.suffix === "%" ? value : (value / Math.max(model.entriesTotal, 1)) * 100));
        const activeCells = Math.ceil(ratio / 20);
        return (
          <li key={row.id ?? row.label}>
            <button
              type="button"
              className="dashboard-heatmap-cell"
              {...model.selectionProps(row, false)}
              style={{ "--heat-color": row.color, "--heat-intensity": 8 + ratio * 0.24 + "%" }}
            >
              <span title={row.label}>{row.label}</span>
              <strong>{model.formatValue(row.value)}</strong>
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
