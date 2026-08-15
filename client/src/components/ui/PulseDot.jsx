const CADENCE = {
  ok: "1.2s",
  warning: "2.6s",
  danger: "1s"
};

/**
 * Small status LED with a pulse-ring whose cadence encodes health:
 * fast/regular when ok, slower/irregular when at risk, static when offline.
 */
export default function PulseDot({ tone = "offline", title, className = "" }) {
  const cadence = CADENCE[tone];

  return (
    <span
      className={`pulse-dot ${tone} ${className}`.trim()}
      style={cadence ? { "--pulse-cadence": cadence } : undefined}
      title={title}
      aria-hidden="true"
    >
      <span className="pulse-dot-core" />
      {cadence && <span className="pulse-dot-ring" />}
    </span>
  );
}
