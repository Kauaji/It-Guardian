import { ResponsiveContainer } from "recharts";

export default function DashboardChartCard({
  title,
  icon: Icon,
  loading,
  empty,
  emptyMessage,
  height = 220,
  children
}) {
  return (
    <section className="panel dashboard-chart-card">
      <div className="panel-heading">
        <h3>{title}</h3>
        {Icon && <Icon size={18} />}
      </div>
      {loading ? (
        <div key="skeleton" className="dashboard-chart-skeleton" style={{ height }} aria-hidden="true" />
      ) : empty ? (
        <p key="empty" className="dashboard-empty-state">{emptyMessage || "Sem dados suficientes neste periodo."}</p>
      ) : (
        <div key="chart" className="chart-box" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
