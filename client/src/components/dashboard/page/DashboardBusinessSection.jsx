import { Building2 } from "lucide-react";

export default function DashboardBusinessSection({ business, byEnvironment, pending }) {
  return (
    <>
      <h2 className="dashboard-section-title">Visão Business</h2>
      <section className="panel dashboard-business-card">
        <div className="panel-heading">
          <h3>Ambientes/organizações atendidas</h3>
          <Building2 size={18} />
        </div>
        {!business?.enabled || !byEnvironment.length ? (
          <p className="dashboard-empty-state">
            {pending ? "Carregando..." : business?.message || "Sem dados de ambiente/organização ainda."}
          </p>
        ) : (
          <ol className="dashboard-ranking-list">
            {byEnvironment.map((item) => (
              <li key={item.key}>
                <div className="dashboard-ranking-item">
                  <strong>{item.label}</strong>
                  <span>{item.count} ordem(ns) de serviço</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        {business?.enabled && !business.clientsWithMostAlertsAvailable && (
          <p className="dashboard-empty-state dashboard-business-note">
            Alertas e ativos ainda não têm vínculo com o cadastro de clientes — essa métrica ficará disponível
            quando esse vínculo existir no sistema.
          </p>
        )}
      </section>
    </>
  );
}
