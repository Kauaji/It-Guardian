import { useState } from "react";
import { registerMaintenanceScriptSimulation, useServiceOrderScript as executeServiceOrderScript } from "../../../../api.js";
import { useModalLifecycle } from "../../../../hooks/useModalLifecycle.js";
import { buildSimulationNotes, requiresRiskAcknowledgement } from "../utils/scriptRules.js";

// Confirmacao de execucao real ou simulacao: dialogo, envio e retorno ao usuario.
export function useScriptConfirmation({ serviceOrder, token, notify, loadActivity }) {
  const [confirmingScript, setConfirmingScript] = useState(null);
  const [confirmMode, setConfirmMode] = useState("execute");
  const [queueing, setQueueing] = useState(false);
  // Escape cancela a confirmacao (e nao o modal da OS por tras); foco preso e devolvido ao botao de origem.
  const confirmDialogRef = useModalLifecycle(Boolean(confirmingScript), () => !queueing && setConfirmingScript(null));
  const serviceOrderId = serviceOrder?.id;

  async function send(request, successMessage) {
    setQueueing(true);
    try {
      await request();
      notify?.(successMessage.text, "success");
      setConfirmingScript(null);
      loadActivity();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setQueueing(false);
    }
  }

  function confirmRun(script, riskAcknowledged) {
    return send(() => executeServiceOrderScript(token, serviceOrderId, script.id, { confirmed: true, riskAcknowledged }), {
      text: "Script enfileirado. Aguardando execução pelo agente da máquina."
    });
  }

  function confirmSimulation(script, riskAcknowledged) {
    return send(
      () =>
        registerMaintenanceScriptSimulation(token, script.id, {
          confirmed: true,
          riskAcknowledged,
          assetId: serviceOrder?.assetId,
          serviceOrderId,
          notes: buildSimulationNotes(serviceOrder, serviceOrderId)
        }),
      { text: "Simulação registrada. Nenhum comando foi executado." }
    );
  }

  function openConfirm(script, mode) {
    setConfirmMode(mode);
    setConfirmingScript(script);
  }

  function cancel() {
    setConfirmingScript(null);
  }

  function cancelUnlessQueueing() {
    if (!queueing) setConfirmingScript(null);
  }

  function confirm() {
    const riskAcknowledged = requiresRiskAcknowledgement(confirmingScript);
    if (confirmMode === "simulate") {
      confirmSimulation(confirmingScript, riskAcknowledged);
    } else {
      confirmRun(confirmingScript, riskAcknowledged);
    }
  }

  return { confirmingScript, confirmMode, queueing, confirmDialogRef, openConfirm, cancel, cancelUnlessQueueing, confirm };
}
