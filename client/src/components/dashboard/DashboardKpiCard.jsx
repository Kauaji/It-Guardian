export default function DashboardKpiCard({ icon: Icon, title, value, subtitle, tone = "", loading }) {
  if (loading) {
    return (
      <article className="dashboard-kpi-card skeleton" aria-hidden="true">
        <div className="dashboard-kpi-skeleton-icon" />
        <div className="dashboard-kpi-skeleton-line" />
        <div className="dashboard-kpi-skeleton-line short" />
      </article>
    );
  }

  return (
    <article className={`dashboard-kpi-card ${tone}`}>
      <div className="dashboard-kpi-card-header">
        {Icon && (
          <span className="dashboard-kpi-icon-badge">
            <Icon size={16} />
          </span>
        )}
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      {subtitle && <p className="dashboard-kpi-subtitle">{subtitle}</p>}
    </article>
  );
}
