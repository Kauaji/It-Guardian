import { useEffect, useState } from "react";
import { ClipboardCheck, PlayCircle, ShieldAlert, Terminal } from "lucide-react";
import {
  fetchMaintenanceScriptRecommendations,
  fetchServiceOrderScriptActivity,
  registerMaintenanceScriptSimulation,
  useServiceOrderScript as executeServiceOrderScript
} from "../../../api.js";
import { hasRemoteAssistanceAgent, isRemoteAssistanceAssetFresh } from "../../remoteAssistance/remoteAssistanceModel.js";
import ScriptExecutionDiagnosticPanel from "../../maintenance/ScriptExecutionDiagnosticPanel.jsx";

const RISK_LABELS = { low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" };
const STATUS_LABELS = {
  queued: "Na fila",
  claimed: "Entregue ao agente",
  succeeded: "Concluído com sucesso",
  failed: "Falhou",
  timed_out: "Tempo limite excedido"
};

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function ServiceOrderScriptsTab({
  serviceOrder,
  asset,
  token,
  notify,
  canManage = false,
  canRegisterSimulation = false,
  remoteScriptExecutionEnabled = false
}) {
  const [activity, setActivity] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingScript, setConfirmingScript] = useState(null);
  const [confirmMode, setConfirmMode] = useState("execute");
  const [queueing, setQueueing] = useState(false);

  const serviceOrderId = serviceOrder?.id;
  const isFinalOrder = Boolean(serviceOrder?.closedAt);
  const hasAsset = Boolean(serviceOrder?.assetId);
  const agentPresent = hasRemoteAssistanceAgent(asset);
  const agentFresh = isRemoteAssistanceAssetFresh(asset);
  const canRunReal = canManage && remoteScriptExecutionEnabled && hasAsset && !isFinalOrder && agentFresh;

  function loadActivity() {
    if (!serviceOrderId || !token) return;
    fetchServiceOrderScriptActivity(token, serviceOrderId)
      .then((response) => setActivity(response.activity || []))
      .catch((error) => notify?.(error.message, "danger"));
  }

  useEffect(() => {
    if (!serviceOrderId || !token) return;
    setLoading(true);
    const context = {
      category: serviceOrder?.category || "",
      problemType: serviceOrder?.problemType || "",
      title: serviceOrder?.title || "",
      description: serviceOrder?.description || ""
    };
    Promise.all([
      fetchServiceOrderScriptActivity(token, serviceOrderId),
      hasAsset
        ? fetchMaintenanceScriptRecommendations(token, { assetIds: [serviceOrder.assetId], context })
        : Promise.resolve({ recommended: [], others: [] })
    ])
      .then(([activityResponse, recommendationResponse]) => {
        setActivity(activityResponse.activity || []);
        setRecommended(recommendationResponse.recommended || []);
        setOthers(recommendationResponse.others || []);
      })
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [serviceOrderId, token, notify]);

  async function confirmRun(script, riskAcknowledged) {
    setQueueing(true);
    try {
      await executeServiceOrderScript(token, serviceOrderId, script.id, { confirmed: true, riskAcknowledged });
      notify?.("Script enfileirado. Aguardando execução pelo agente da máquina.", "success");
      setConfirmingScript(null);
      loadActivity();
      setTimeout(loadActivity, 4000);
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setQueueing(false);
    }
  }

  async function confirmSimulation(script, riskAcknowledged) {
    setQueueing(true);
    try {
      await registerMaintenanceScriptSimulation(token, script.id, {
        confirmed: true,
        riskAcknowledged,
        assetId: serviceOrder?.assetId,
        serviceOrderId,
        notes: `Simulação registrada pela aba Scripts da OS ${serviceOrder?.number || serviceOrderId}.`
      });
      notify?.("Simulação registrada. Nenhum comando foi executado.", "success");
      setConfirmingScript(null);
      loadActivity();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setQueueing(false);
    }
  }

  function openConfirm(script, mode) {
    setConfirmMode(mode);
    setConfirmingScript(script);
  }

  function blockReason() {
    if (!hasAsset) return "Esta OS não tem uma máquina/ativo vinculado.";
    if (isFinalOrder) return "Esta OS está finalizada. Reabra a OS para executar scripts.";
    if (!remoteScriptExecutionEnabled) return "Execução real desabilitada no servidor. Somente simulação e registro estão disponíveis.";
    if (!agentPresent) return "Esta máquina não possui agente registrado.";
    if (!agentFresh) return "O agente desta máquina está offline ou desatualizado.";
    if (!canManage) return "Você não tem permissão para executar scripts nesta OS.";
    return "";
  }

  const reason = canRunReal ? "" : blockReason();
  const canRunSimulation = canRegisterSimulation && hasAsset && !isFinalOrder && !canRunReal;

  if (loading) return <p className="loading-message">Carregando scripts...</p>;

  return (
    <section className="service-order-scripts-panel">
      {!remoteScriptExecutionEnabled && (
        <p className="service-order-scripts-banner">
          <ShieldAlert size={16} />
          Execução real desabilitada. Este script pode ser registrado em modo simulação, mas não será enviado ao agente.
        </p>
      )}
      {reason && remoteScriptExecutionEnabled && (
        <p className="service-order-scripts-banner">
          <ShieldAlert size={16} />
          {reason}
        </p>
      )}

      {hasAsset && (
        <ScriptExecutionDiagnosticPanel token={token} assetId={serviceOrder.assetId} context="service_order" />
      )}

      <div className="service-order-scripts-list">
        <h4>Scripts recomendados</h4>
        {!recommended.length && !others.length && <p className="empty">Nenhum script ativo cadastrado no catálogo.</p>}
        {[...recommended, ...others].map((script) => (
          <article key={script.id} className="service-order-script-card">
            <div>
              <strong>{script.name}</strong>
              <span className={`service-order-script-risk risk-${script.riskLevel}`}>
                {RISK_LABELS[script.riskLevel] || script.riskLevel}
              </span>
            </div>
            {script.recommendationReason && <p>{script.recommendationReason}</p>}
            {script.estimatedSummary && <p>{script.estimatedSummary}</p>}
            <div className="service-order-script-card-actions">
              <button
                type="button"
                className="primary-action compact-action"
                disabled={!canRunReal || queueing}
                onClick={() => openConfirm(script, "execute")}
                title={reason || undefined}
              >
                <PlayCircle size={14} />
                Executar no agente
              </button>
              {canRunSimulation && (
                <button
                  type="button"
                  className="ghost-action compact-action"
                  disabled={queueing}
                  onClick={() => openConfirm(script, "simulate")}
                  title="Registra a intenção de uso do script sem enviar nada ao agente."
                >
                  <ClipboardCheck size={14} />
                  Registrar simulação
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="service-order-scripts-activity">
        <h4>Atividade</h4>
        {!activity.length && <p className="empty">Nenhum script executado nesta OS ainda.</p>}
        <ul>
          {activity.map((entry) => (
            <li key={entry.id}>
              <Terminal size={14} />
              <div>
                <strong>{entry.scriptName || "Script"}</strong>
                <span>
                  {STATUS_LABELS[entry.job?.status || entry.status] || entry.status} · {formatDate(entry.executedAt || entry.createdAt)}
                </span>
                {entry.job?.stdout && <p className="service-order-script-output">{entry.job.stdout.slice(0, 400)}</p>}
                {entry.job?.stderr && <p className="service-order-script-output error">{entry.job.stderr.slice(0, 400)}</p>}
                {entry.job?.errorMessage && <p className="service-order-script-output error">{entry.job.errorMessage}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {confirmingScript && (
        <div className="modal-backdrop" role="presentation" onClick={() => !queueing && setConfirmingScript(null)}>
          <section
            className="service-order-script-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={confirmMode === "simulate" ? "Confirmar simulação de script" : "Confirmar execução de script"}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{confirmMode === "simulate" ? "Confirmar simulação" : "Confirmar execução"}</h3>
            <dl>
              <dt>Script</dt>
              <dd>{confirmingScript.name}</dd>
              <dt>Risco</dt>
              <dd>{RISK_LABELS[confirmingScript.riskLevel] || confirmingScript.riskLevel}</dd>
              <dt>Máquina alvo</dt>
              <dd>{asset?.name || serviceOrder?.assetId}</dd>
              {confirmMode === "execute" && (
                <>
                  <dt>Timeout</dt>
                  <dd>até 600s</dd>
                  <dt>Requer administrador</dt>
                  <dd>{confirmingScript.requiresAdmin ? "Sim" : "Não"}</dd>
                  <dt>Requer usuário logado</dt>
                  <dd>{confirmingScript.requiresLoggedUser ? "Sim" : "Não"}</dd>
                </>
              )}
            </dl>
            <p>
              {confirmMode === "simulate"
                ? "Nenhum comando será executado. Esta ação apenas registra a intenção de uso do script no histórico da OS, no prontuário do ativo e nos logs de auditoria."
                : "Este script será executado na máquina selecionada pelo agente IT Guardian. A execução será registrada no histórico da OS, no prontuário do ativo e nos logs de auditoria."}
            </p>
            <div className="service-order-script-confirm-actions">
              <button type="button" className="ghost-action compact-action" onClick={() => setConfirmingScript(null)} disabled={queueing}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-action compact-action"
                disabled={queueing}
                onClick={() => {
                  const riskAcknowledged = confirmingScript.riskLevel === "high" || confirmingScript.riskLevel === "critical";
                  if (confirmMode === "simulate") {
                    confirmSimulation(confirmingScript, riskAcknowledged);
                  } else {
                    confirmRun(confirmingScript, riskAcknowledged);
                  }
                }}
              >
                {queueing ? "Enviando..." : confirmMode === "simulate" ? "Confirmar simulação" : "Confirmar execução"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
