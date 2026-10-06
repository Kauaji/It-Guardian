import { getServiceOrderOriginLabel, priorityLabels } from "../../serviceOrderBoardUtils.js";
import { formatCurrency } from "../utils/money.js";
import { formatDate } from "../utils/text.js";
import DetailItem from "./DetailItem.jsx";

function SectorField({ serviceOrder, canChangeSector, availableSectors, saving, onChangeSector }) {
  if (!canChangeSector) {
    return <DetailItem label="Setor responsável" value={serviceOrder.sectorName || "Geral"} />;
  }
  return (
    <label className="service-order-detail-item service-order-sector-edit">
      <span>Setor responsável</span>
      <select value={serviceOrder.sectorId || "sector-geral"} disabled={saving} onChange={(event) => onChangeSector(event.target.value)}>
        {availableSectors.map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function getServiceDescription(serviceOrder) {
  return serviceOrder.serviceCode && serviceOrder.serviceName
    ? `${serviceOrder.serviceCode} - ${serviceOrder.serviceName}`
    : serviceOrder.serviceName || serviceOrder.serviceCode || serviceOrder.servicePerformed;
}

// Aba Geral: solicitacao, observacoes iniciais e grade de dados da OS.
export default function GeneralTab({
  serviceOrder,
  statusLabelMap,
  businessMode,
  environmentLabel,
  asset,
  backupAsset,
  canChangeSector,
  availableSectors,
  saving,
  onChangeSector
}) {
  return (
    <div className="service-order-general-stack">
      <section className="service-order-text-panel">
        <h3>Solicitação</h3>
        <p>{serviceOrder.description || "Sem descrição informada."}</p>
        {serviceOrder.notes && (
          <>
            <h3>Observações iniciais</h3>
            <p>{serviceOrder.notes}</p>
          </>
        )}
      </section>
      <section className="service-order-detail-grid">
        <DetailItem label="Número" value={serviceOrder.number} />
        <DetailItem label="Status" value={statusLabelMap[serviceOrder.status] || serviceOrder.status} />
        <DetailItem label="Prioridade" value={priorityLabels[serviceOrder.priority]} />
        {serviceOrder.preventivePlanId && <DetailItem label="Origem preventiva" value="Plano Preventivo" />}
        {serviceOrder.source === "public_support_form" && <DetailItem label="Origem" value={getServiceOrderOriginLabel(serviceOrder)} />}
        <SectorField
          serviceOrder={serviceOrder}
          canChangeSector={canChangeSector}
          availableSectors={availableSectors}
          saving={saving}
          onChangeSector={onChangeSector}
        />
        <DetailItem label={environmentLabel} value={serviceOrder.environmentName} />
        <DetailItem label="Máquina/ativo" value={asset?.name || serviceOrder.assetId} />
        <DetailItem label="Máquina Backup" value={backupAsset?.name || serviceOrder.backupAssetId} />
        <DetailItem label="Solicitante" value={serviceOrder.requesterName} />
        <DetailItem label="Técnico" value={serviceOrder.assignedTechnicianName} />
        <DetailItem label="Categoria" value={serviceOrder.category} />
        <DetailItem label="Serviço" value={getServiceDescription(serviceOrder)} />
        <DetailItem label="Aberta em" value={formatDate(serviceOrder.createdAt)} />
        <DetailItem label="Atualizada em" value={formatDate(serviceOrder.updatedAt)} />
        <DetailItem label="Finalizada em" value={formatDate(serviceOrder.closedAt)} />
        {businessMode && (
          <>
            <DetailItem
              label="Valor do serviço"
              value={serviceOrder.serviceValue ? formatCurrency(serviceOrder.serviceValue) : "Não informado"}
            />
            <DetailItem label="Total de peças" value={formatCurrency(serviceOrder.totalPartsValue)} />
            <DetailItem label="Total estimado" value={formatCurrency(serviceOrder.totalValue)} />
          </>
        )}
      </section>
    </div>
  );
}
