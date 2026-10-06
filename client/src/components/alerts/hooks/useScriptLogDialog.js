import { useState } from "react";
import { buildScriptLogFromValidation } from "../alertDisplayUtils.js";

function validationRecency(validation) {
  return new Date(validation.finishedAt || validation.job?.completedAt || validation.startedAt || 0).getTime();
}

// Modal de log de script: abertura (por card ou pela barra de abas) e as
// acoes de acompanhamento sobre o log selecionado.
export default function useScriptLogDialog({
  suggestions,
  onApplyScriptLogSuggestedSolution,
  onAcknowledgeScriptLog,
  onCancelScriptValidation
}) {
  const [selectedScriptLog, setSelectedScriptLog] = useState(null);
  const [customNotes, setCustomNotes] = useState("");

  function openFromValidation(validation) {
    setSelectedScriptLog(buildScriptLogFromValidation(validation));
  }

  function openLatestLog() {
    const latest = suggestions
      .map((suggestion) => suggestion?.latestValidation || null)
      .filter((validation) => validation?.log)
      .sort((a, b) => validationRecency(b) - validationRecency(a))[0];

    if (latest?.log) {
      openFromValidation(latest);
      return;
    }

    window.alert("Nenhum log de script disponível.");
  }

  function finish() {
    setSelectedScriptLog(null);
    setCustomNotes("");
  }

  async function registerSuggestedSolution() {
    const confirmed = window.confirm(
      "Esta ação não executara comandos automaticamente nesta versão. Ela registrará uma ação corretiva sugerida para acompanhamento."
    );
    if (!confirmed) return;
    await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, {
      notes: selectedScriptLog.suggestedSolution || "Solução sugerida registrada para acompanhamento."
    });
    finish();
  }

  async function registerCustomSolution() {
    const notes = customNotes.trim() || "Solução própria registrada pelo técnico.";
    await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, { notes });
    finish();
  }

  async function acknowledge() {
    await onAcknowledgeScriptLog(selectedScriptLog.id);
    finish();
  }

  async function cancelAnalysis() {
    if (selectedScriptLog.validationId && onCancelScriptValidation) {
      await onCancelScriptValidation(selectedScriptLog.validationId);
    } else {
      await onAcknowledgeScriptLog(selectedScriptLog.id);
    }
    finish();
  }

  return {
    selectedScriptLog,
    customNotes,
    setCustomNotes,
    openFromValidation,
    openLatestLog,
    // Fecha sem limpar as notas, como o botao "Fechar" do modal original.
    close: () => setSelectedScriptLog(null),
    registerSuggestedSolution,
    registerCustomSolution,
    acknowledge,
    cancelAnalysis
  };
}
