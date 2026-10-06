// Regras puras da aba Scripts da OS: rotulos, estados de job e motivos de bloqueio.

export const RISK_LABELS = { low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" };

export const STATUS_LABELS = {
  queued: "Na fila, aguardando o agente",
  claimed: "Executando agora no agente",
  succeeded: "Concluído com sucesso",
  failed: "Falhou",
  timed_out: "Tempo limite excedido"
};

export const ACTIVE_JOB_STATUSES = new Set(["queued", "claimed"]);
export const ACTIVE_POLL_INTERVAL_MS = 5000;
export const ACTIVE_POLL_MAX_ATTEMPTS = 90;

export function formatScriptDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

/** Estado do job de uma entrada da atividade (o do job tem prioridade). */
export function getEntryStatus(entry) {
  return entry.job?.status || entry.status;
}

export function hasActiveJob(activity) {
  return activity.some((entry) => ACTIVE_JOB_STATUSES.has(getEntryStatus(entry)));
}

/** Riscos alto e critico exigem reconhecimento explicito na confirmacao. */
export function requiresRiskAcknowledgement(script) {
  return script.riskLevel === "high" || script.riskLevel === "critical";
}

/** Contexto enviado ao motor de recomendacao a partir da OS. */
export function buildRecommendationContext(serviceOrder) {
  return {
    category: serviceOrder?.category || "",
    problemType: serviceOrder?.problemType || "",
    title: serviceOrder?.title || "",
    description: serviceOrder?.description || ""
  };
}

export function buildSimulationNotes(serviceOrder, serviceOrderId) {
  return `Simulação registrada pela aba Scripts da OS ${serviceOrder?.number || serviceOrderId}.`;
}

/** Por que a execucao real esta indisponivel (texto vazio quando nao ha bloqueio). */
export function getScriptBlockReason({ hasAsset, isFinalOrder, remoteScriptExecutionEnabled, agentPresent, agentFresh, canManage }) {
  if (!hasAsset) return "Esta OS não tem uma máquina/ativo vinculado.";
  if (isFinalOrder) return "Esta OS está finalizada. Reabra a OS para executar scripts.";
  if (!remoteScriptExecutionEnabled) return "Execução real desabilitada no servidor. Somente simulação e registro estão disponíveis.";
  if (!agentPresent) return "Esta máquina não possui agente registrado.";
  if (!agentFresh) return "O agente desta máquina está offline ou desatualizado.";
  if (!canManage) return "Você não tem permissão para executar scripts nesta OS.";
  return "";
}
