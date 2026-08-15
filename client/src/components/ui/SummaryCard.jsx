import AnimatedNumber from "./AnimatedNumber.jsx";

export default function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`summary-card ${tone || ""}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong><AnimatedNumber value={value} /></strong>
    </article>
  );
}
