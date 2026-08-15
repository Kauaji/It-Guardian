import AnimatedNumber from "../ui/AnimatedNumber.jsx";

export default function DashboardKpiStrip({ items, loading }) {
  return (
    <section className="dashboard-kpi-strip" aria-label="Indicadores operacionais">
      {items.map((item) => (
        <div key={item.title} className={`dashboard-kpi-strip-cell ${item.tone || ""}`.trim()}>
          <span className="dashboard-kpi-strip-label">{item.title}</span>
          {loading ? (
            <span className="dashboard-kpi-strip-value-skeleton" aria-hidden="true" />
          ) : (
            <span className="dashboard-kpi-strip-value">
              <AnimatedNumber value={item.value} />
            </span>
          )}
          {item.subtitle && <span className="dashboard-kpi-strip-subtitle">{item.subtitle}</span>}
        </div>
      ))}
    </section>
  );
}
