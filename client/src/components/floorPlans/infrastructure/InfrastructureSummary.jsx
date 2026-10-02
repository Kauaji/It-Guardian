const SUMMARY_FIELDS = [
  ["Componentes", "totalComponents"],
  ["Ativos vinculados", "linkedAssets"],
  ["Online", "onlineAssets"],
  ["Offline", "offlineAssets"],
  ["Sem agente", "assetsWithoutAgent"],
  ["OS abertas", "openServiceOrders"],
  ["OS vencidas", "overdueServiceOrders"],
  ["Alertas críticos", "criticalAlerts"],
  ["Segmentos", "segmentsRepresented"],
  ["Grupos", "groupsRepresented"]
];

export default function InfrastructureSummary({ summary = {} }) {
  return (
    <section className="infrastructure-summary-panel">
      <header>
        <div>
          <span>Leitura operacional da planta</span>
          <h3>Dashboard da Infraestrutura</h3>
        </div>
        <p>Indicadores calculados apenas sobre componentes realmente posicionados e vinculados.</p>
      </header>
      <div>
        {SUMMARY_FIELDS.map(([label, field]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{summary[field] || 0}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
