import { useCountUp } from "../../../hooks/useCountUp.js";

// Mesma paleta de DashboardHealthScore.jsx's toneColors, para o gauge
// generalizado ter identidade visual identica ao gauge de saude original.
const toneColors = {
  ok: "#1f7a61",
  warning: "#d6a21f",
  danger: "#d64545"
};

/**
 * Generaliza o gauge circular ja usado em DashboardHealthScore.jsx (mesma
 * tecnica: circulo de fundo + circulo de progresso com stroke-dashoffset)
 * para qualquer valor 0..max, nao so a nota de saude -- reaproveitado pelos
 * widgets de status geral e de gauge de CPU/RAM/Disco por ativo.
 */
export default function GaugeSvg({ value, max = 100, tone = "ok", label, size = 84, suffix = "" }) {
  const strokeWidth = Math.round(size * 0.095);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
  const offset = circumference * (1 - safeValue / max);
  const color = toneColors[tone] || toneColors.ok;
  const displayValue = useCountUp(Number.isFinite(value) ? Math.round(value) : 0);

  return (
    <svg
      className="dashboard-gauge-svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label ? `${label}: ${Number.isFinite(value) ? value : "sem dado"}${suffix}` : undefined}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
      {Number.isFinite(value) && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="dashboard-gauge-svg-value"
        />
      )}
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="dashboard-gauge-svg-text tabular-nums">
        {Number.isFinite(value) ? `${displayValue}${suffix}` : "--"}
      </text>
    </svg>
  );
}
