import { X } from "lucide-react";

function formatMetrics(metrics) {
  return [metrics.cpu, metrics.ram, metrics.disk].map((value) => (value == null ? "—" : `${value}%`)).join(" · ");
}

function DetailRow({ label, children }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Painel somente leitura com os detalhes operacionais do componente selecionado. */
export default function InfrastructureObjectPanel({ object, device, heatmap, mode, onClose }) {
  if (!object) return null;
  const metrics = device?.metrics || {};
  return (
    <aside className="infrastructure-object-panel">
      <header>
        <div>
          <small>Componente semântico</small>
          <strong>{object.label}</strong>
        </div>
        <button type="button" className="icon-button" aria-label="Fechar detalhes" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      {object.metadata?.description ? <p>{object.metadata.description}</p> : null}
      <dl>
        <DetailRow label="Tipo">{object.objectType}</DetailRow>
        <DetailRow label="Criticidade">{object.metadata?.criticality || "normal"}</DetailRow>
        <DetailRow label="Ativo">
          {device ? device.alias || device.hostname || device.name : object.linkedAssetId || "Não vinculado"}
        </DetailRow>
        <DetailRow label="Status">{device?.status || heatmap?.status || object.metadata?.manualStatus || "Sem dados"}</DetailRow>
        <DetailRow label="CPU / RAM / Disco">{formatMetrics(metrics)}</DetailRow>
        {mode === "heatmap-os" ? (
          <>
            <DetailRow label="OS no período">{heatmap?.totalServiceOrders || 0}</DetailRow>
            <DetailRow label="Abertas / vencidas">
              {heatmap?.openServiceOrders || 0} / {heatmap?.overdueServiceOrders || 0}
            </DetailRow>
          </>
        ) : null}
      </dl>
    </aside>
  );
}
