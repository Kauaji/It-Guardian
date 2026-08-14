import { HeartPulse } from "lucide-react";
import { healthClassificationTone } from "./dashboardFormatters.js";

const toneColors = {
  ok: "#1f7a61",
  warning: "#d6a21f",
  danger: "#d64545"
};

const GAUGE_SIZE = 84;
const GAUGE_STROKE = 8;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function HealthGauge({ score, tone }) {
  const color = toneColors[tone] || toneColors.warning;
  const offset = GAUGE_CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <svg
      className="dashboard-health-gauge"
      width={GAUGE_SIZE}
      height={GAUGE_SIZE}
      viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
      role="img"
      aria-label={`Nota de saude: ${score} de 100`}
    >
      <circle
        cx={GAUGE_SIZE / 2}
        cy={GAUGE_SIZE / 2}
        r={GAUGE_RADIUS}
        fill="none"
        stroke="var(--border)"
        strokeWidth={GAUGE_STROKE}
      />
      <circle
        cx={GAUGE_SIZE / 2}
        cy={GAUGE_SIZE / 2}
        r={GAUGE_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
        strokeDasharray={GAUGE_CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}
        className="dashboard-health-gauge-value"
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="dashboard-health-gauge-text">
        {score}
      </text>
    </svg>
  );
}

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
        <HealthGauge score={health.score} tone={tone} />
        <div className="dashboard-health-score-summary">
          <span className={`pill ${tone}`}>{health.classificationLabel}</span>
          <span className="dashboard-health-score-scale">de 0 a 100 pontos</span>
        </div>
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
