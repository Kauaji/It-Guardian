import { ExternalLink, ShieldAlert } from "lucide-react";
import { readableSnapshot } from "../utils/partsModel.js";

export default function PartDiscrepancyPanel({ part, permissions, saving, onOpenAsset, onReviewDiscrepancy }) {
  const assetId = part.assignedAssetId || part.sourceAssetId;
  const missing = part.discrepancyStatus === "missing";
  return (
    <div className="part-discrepancy">
      <ShieldAlert />
      <div>
        <strong>{missing ? "Componente não localizado" : "Alteração física detectada"}</strong>
        <span>
          {part.discrepancyDetails?.reason || "O agente identificou uma mudança de hardware sem movimentação ou OS correspondente."}
        </span>
        <dl className="part-discrepancy-comparison">
          <div>
            <dt>Antes</dt>
            <dd>{readableSnapshot(part.discrepancyDetails?.previous)}</dd>
          </div>
          <div>
            <dt>Coleta atual</dt>
            <dd>{missing ? "Não localizado nesta máquina" : readableSnapshot(part.discrepancyDetails?.current)}</dd>
          </div>
        </dl>
        {assetId ? (
          <button type="button" onClick={() => onOpenAsset?.(assetId)}>
            <ExternalLink size={14} /> Localizar máquina no Inventário de Ativos
          </button>
        ) : null}
        {permissions.reconcileHardware ? (
          <div className="part-discrepancy-actions">
            <button type="button" className="secondary-action" disabled={saving} onClick={() => onReviewDiscrepancy("keep")}>
              Manter pendente
            </button>
            <button type="button" className="secondary-action danger" disabled={saving} onClick={() => onReviewDiscrepancy("dismiss")}>
              Descartar incongruência
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
