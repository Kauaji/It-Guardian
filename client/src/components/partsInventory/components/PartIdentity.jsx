import { assetDisplayName, INVENTORY_LABELS } from "../utils/partsModel.js";

export default function PartIdentity({ part, devices }) {
  return (
    <dl className="part-identity">
      <div>
        <dt>Situação</dt>
        <dd>{INVENTORY_LABELS[part.inventoryState] || part.inventoryState}</dd>
      </div>
      <div>
        <dt>Quantidade</dt>
        <dd>
          {part.quantity} {part.unit}
        </dd>
      </div>
      <div>
        <dt>ID da peça</dt>
        <dd>{part.internalCode || part.id}</dd>
      </div>
      <div>
        <dt>Série / MAC</dt>
        <dd>{part.serialNumber || part.macAddress || "—"}</dd>
      </div>
      <div>
        <dt>Localização</dt>
        <dd>{part.location || "Não informada"}</dd>
      </div>
      <div>
        <dt>Ativo atual</dt>
        <dd>{part.assignedAssetId ? assetDisplayName(devices, part.assignedAssetId) : "Não vinculado"}</dd>
      </div>
      {part.supplierName ? (
        <div className="wide">
          <dt>Fornecedor</dt>
          <dd>{part.supplierName}</dd>
        </div>
      ) : null}
    </dl>
  );
}
