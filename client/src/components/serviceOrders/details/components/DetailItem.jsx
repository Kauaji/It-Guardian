export default function DetailItem({ label, value }) {
  return (
    <div className="service-order-detail-item">
      <span>{label}</span>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}
