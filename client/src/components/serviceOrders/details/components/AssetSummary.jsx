import { Monitor } from "lucide-react";
import { assetTypeLabel } from "../../../inventory/assetTypes.js";
import { formatDate } from "../utils/text.js";
import DetailItem from "./DetailItem.jsx";

const NOT_AVAILABLE = "Não disponível";

function percent(value) {
  return value != null ? `${value}%` : NOT_AVAILABLE;
}

// Ficha resumida da maquina vinculada a OS.
export default function AssetSummary({ asset, serviceOrder, environmentLabel }) {
  return (
    <>
      <div>
        <Monitor size={18} />
        <strong>{asset.name}</strong>
        <span>{asset.ip} - {assetTypeLabel(asset.assetType)} - {asset.statusLabel}</span>
      </div>
      <div className="service-order-detail-grid">
        <DetailItem label="Nome fantasia" value={asset.alias || asset.displayName || asset.name} />
        <DetailItem label="IP" value={asset.ip} />
        <DetailItem label="Status" value={asset.statusLabel} />
        <DetailItem label="Tipo" value={assetTypeLabel(asset.assetType)} />
        <DetailItem label={environmentLabel} value={serviceOrder.environmentName} />
        <DetailItem label="Segmento" value={asset.segmentName} />
        <DetailItem label="Sistema operacional" value={asset.hardware?.os} />
        <DetailItem label="Fabricante" value={asset.hardware?.manufacturer} />
        <DetailItem label="Modelo" value={asset.hardware?.model} />
        <DetailItem label="Serial" value={asset.hardware?.serialNumber} />
        <DetailItem label="Patrimônio" value={asset.hardware?.assetTag || asset.manualAsset?.assetTag} />
        <DetailItem label="CPU" value={percent(asset.metrics?.cpu)} />
        <DetailItem label="RAM" value={percent(asset.metrics?.ram)} />
        <DetailItem label="Disco" value={percent(asset.metrics?.disk)} />
        <DetailItem label="Saúde do disco" value={asset.hardware?.diskHealth || asset.hardware?.smartStatus || NOT_AVAILABLE} />
        <DetailItem label="Último inventário" value={formatDate(asset.hardware?.lastInventoryAt)} />
        <DetailItem label="Último ping" value={formatDate(asset.lastPingAt)} />
      </div>
    </>
  );
}
