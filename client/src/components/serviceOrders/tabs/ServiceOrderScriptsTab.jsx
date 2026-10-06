import { hasRemoteAssistanceAgent, isRemoteAssistanceAssetFresh } from "../../remoteAssistance/remoteAssistanceModel.js";
import ScriptExecutionDiagnosticPanel from "../../maintenance/ScriptExecutionDiagnosticPanel.jsx";
import ScriptActivityList from "../scripts/components/ScriptActivityList.jsx";
import ScriptCard from "../scripts/components/ScriptCard.jsx";
import ScriptConfirmDialog from "../scripts/components/ScriptConfirmDialog.jsx";
import ScriptsBanners from "../scripts/components/ScriptsBanners.jsx";
import { useScriptCatalog } from "../scripts/hooks/useScriptCatalog.js";
import { useScriptConfirmation } from "../scripts/hooks/useScriptConfirmation.js";
import { getScriptBlockReason } from "../scripts/utils/scriptRules.js";

export default function ServiceOrderScriptsTab({
  serviceOrder,
  asset,
  token,
  notify,
  canManage = false,
  canRegisterSimulation = false,
  remoteScriptExecutionEnabled = false
}) {
  const { activity, recommended, others, loading, loadActivity } = useScriptCatalog({ serviceOrder, token, notify });
  const confirmation = useScriptConfirmation({ serviceOrder, token, notify, loadActivity });

  const isFinalOrder = Boolean(serviceOrder?.closedAt);
  const hasAsset = Boolean(serviceOrder?.assetId);
  const agentPresent = hasRemoteAssistanceAgent(asset);
  const agentFresh = isRemoteAssistanceAssetFresh(asset);
  const canRunReal = canManage && remoteScriptExecutionEnabled && hasAsset && !isFinalOrder && agentFresh;
  const reason = canRunReal
    ? ""
    : getScriptBlockReason({ hasAsset, isFinalOrder, remoteScriptExecutionEnabled, agentPresent, agentFresh, canManage });
  const canRunSimulation = canRegisterSimulation && hasAsset && !isFinalOrder && !canRunReal;

  if (loading) return <p className="loading-message">Carregando scripts...</p>;

  return (
    <section className="service-order-scripts-panel">
      <ScriptsBanners remoteScriptExecutionEnabled={remoteScriptExecutionEnabled} reason={reason} />

      {hasAsset && (
        <ScriptExecutionDiagnosticPanel token={token} assetId={serviceOrder.assetId} context="service_order" />
      )}

      <div className="service-order-scripts-list">
        <h4>Scripts recomendados</h4>
        {!recommended.length && !others.length && <p className="empty">Nenhum script ativo cadastrado no catálogo.</p>}
        {[...recommended, ...others].map((script) => (
          <ScriptCard
            key={script.id}
            script={script}
            canRunReal={canRunReal}
            canRunSimulation={canRunSimulation}
            queueing={confirmation.queueing}
            reason={reason}
            onConfirm={confirmation.openConfirm}
          />
        ))}
      </div>

      <ScriptActivityList activity={activity} />

      {confirmation.confirmingScript && (
        <ScriptConfirmDialog confirmation={confirmation} machineName={asset?.name || serviceOrder?.assetId} />
      )}
    </section>
  );
}
