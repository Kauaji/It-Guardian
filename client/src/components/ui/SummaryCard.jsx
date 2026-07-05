export default function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`summary-card ${tone || ""}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
