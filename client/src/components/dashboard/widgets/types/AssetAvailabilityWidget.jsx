const statusLabels = { online: "Online", offline: "Offline", problem: "Erro", unknown: "Sem dados" };
const statusTones = { online: "ok", offline: "warning", problem: "danger", unknown: "" };

export default function AssetAvailabilityWidget({ data }) {
  if (!data.total) {
    return <p className="dashboard-empty-state">Nenhum ativo cadastrado ainda.</p>;
  }

  return (
    <dl className="dashboard-widget-stat-grid">
      {Object.entries(data.byStatus).map(([status, count]) => (
        <div key={status} className={statusTones[status]}>
          <dt>{statusLabels[status] || status}</dt>
          <dd>{count}</dd>
        </div>
      ))}
    </dl>
  );
}
