import { HeartPulse } from "lucide-react";
import { healthClassificationTone } from "./dashboardFormatters.js";

export default function DashboardHealthScore({ health, loading }) {
  if (loading) {
    return (
      <section className="panel dashboard-health-card skeleton" aria-hidden="true">
        <div className="dashboard-kpi-skeleton-line" />
        <div className="dashboard-kpi-skeleton-line short" />
      </section>
    );
  }

  if (!health) {
    return (
      <section className="panel dashboard-health-card">
        <div className="panel-heading">
          <h3>Saude da infraestrutura</h3>
          <HeartPulse size={18} />
        </div>
        <p className="dashboard-empty-state">Dados insuficientes para calcular a saude agora.</p>
      </section>
    );
  }

  const tone = healthClassificationTone(health.classification);

  return (
    <section className={`panel dashboard-health-card tone-${tone}`}>
      <div className="panel-heading">
        <h3>Saude da infraestrutura</h3>
        <HeartPulse size={18} />
      </div>
      <div className="dashboard-health-score-row">
        <strong className="dashboard-health-score">{health.score}</strong>
        <span className={`pill ${tone}`}>{health.classificationLabel}</span>
      </div>
      <p className="dashboard-health-caption">
        Calculada a partir de ativos, alertas e ordens de servico reais: comeca em 100 pontos e perde pontos por
        problema real encontrado.
      </p>
      {health.deductions.length > 0 ? (
        <ul className="dashboard-health-deductions">
          {health.deductions.map((item) => (
            <li key={item.reason}>
              <span>{item.reason}</span>
              <strong>-{item.points}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-empty-state">Nenhum fator de reducao identificado no momento.</p>
      )}
    </section>
  );
}
