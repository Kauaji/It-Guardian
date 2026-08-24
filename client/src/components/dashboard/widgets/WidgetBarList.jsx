/**
 * Lista de barras horizontais proporcionais ao maior valor da propria lista
 * -- usado por distribuicoes label+contagem (OS por status, alertas por
 * severidade), leve o bastante para caber dentro de um widget sem puxar o
 * recharts para algo tao simples quanto uma barra.
 */
export default function WidgetBarList({ rows, emptyMessage, toneFor }) {
  if (!rows?.length) {
    return <p className="dashboard-empty-state">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <ul className="dashboard-widget-bar-list">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="dashboard-widget-bar-label">
            <span>{row.label}</span>
            <strong>{row.count}</strong>
          </div>
          <div className="dashboard-widget-bar-track">
            <div
              className={`dashboard-widget-bar-fill ${toneFor?.(row.label) || ""}`}
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
