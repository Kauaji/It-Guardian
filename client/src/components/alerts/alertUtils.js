import { formatDate } from "../../utils/display.js";

export const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

export const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

export const defaultPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};

const defaultAutoPriority = {
  enabled: false,
  lowToMediumHours: 24,
  mediumToHighHours: 48,
  highToCriticalHours: 72
};

const defaultAlertOperationalSettings = {
  rejectedAlertSilenceHours: 24,
  recurrenceCounterResetHours: 24,
  preventiveDueDays: 180,
  scriptValidationWindowMinutes: 30
};

export function normalizePrioritySettings(settings = {}) {
  return {
    rejectedAlertSilenceHours: Math.max(
      1,
      Number(settings.rejectedAlertSilenceHours || defaultAlertOperationalSettings.rejectedAlertSilenceHours)
    ),
    recurrenceCounterResetHours: Math.max(
      1,
      Number(settings.recurrenceCounterResetHours || defaultAlertOperationalSettings.recurrenceCounterResetHours)
    ),
    preventiveDueDays: Math.max(
      1,
      Number(settings.preventiveDueDays || defaultAlertOperationalSettings.preventiveDueDays)
    ),
    scriptValidationWindowMinutes: Math.min(
      10080,
      Math.max(
        5,
        Number(settings.scriptValidationWindowMinutes || defaultAlertOperationalSettings.scriptValidationWindowMinutes)
      )
    ),
    autoPriority: {
      ...defaultAutoPriority,
      ...(settings.autoPriority || {})
    },
    priorityColors: {
      ...defaultPriorityColors,
      ...(settings.priorityColors || {})
    }
  };
}

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const suggestionStatusLabels = {
  pending: "Pendente",
  accepted: "OS criada",
  rejected: "Recusada",
  observed_resolved: "Observado como normalizado",
  observed_persistent: "Observado como persistente",
  validation_cancelled: "Observação cancelada",
  converted_to_os: "Convertida em OS",
  validated: "Validada"
};

const actionableSuggestionStatuses = new Set([
  "pending",
  "observed_persistent",
  "insufficient_data",
  "validation_cancelled"
]);

export function canCreateServiceOrderFromSuggestion(suggestion = {}) {
  return actionableSuggestionStatuses.has(suggestion.status) && !suggestion.createdServiceOrderId;
}

export function canRejectSuggestion(suggestion = {}) {
  return actionableSuggestionStatuses.has(suggestion.status);
}

export function canUseScriptOnSuggestion(suggestion = {}) {
  return actionableSuggestionStatuses.has(suggestion.status);
}

export const scriptValidationLabels = {
  pending_validation: "Aguardando observação",
  waiting_agent: "Aguardando agente seguro",
  prepared: "Preparado",
  observation_pending: "Observação em andamento",
  observed_resolved: "Observado como normalizado",
  observed_persistent: "Observado como persistente",
  execution_confirmed: "Execução confirmada",
  execution_success: "Execução confirmada com sucesso",
  execution_failed: "Execução confirmada com erro",
  insufficient_data: "Dados insuficientes",
  validation_success: "Resolvido após validação",
  validation_failed: "Problema persistente",
  validation_cancelled: "Observação cancelada"
};

export function getScriptValidationTooltip(validation = {}) {
  if (!validation?.status) return "";
  const dueText = validation.validationDueAt ? ` Previsão: ${formatDate(validation.validationDueAt)}.` : "";
  if (validation.status === "observed_persistent") {
    return "O aviso continuou ativo durante o período de observação. Nenhum comando foi executado.";
  }
  if (validation.status === "observed_resolved") {
    return "O aviso não voltou durante o período de observação. Isso não confirma execução de script.";
  }
  if (validation.status === "insufficient_data") {
    return "Não há dados suficientes para concluir a observação.";
  }
  if (validation.status === "validation_cancelled") {
    return "Observação cancelada.";
  }
  if (validation.status === "execution_success") {
    return "Execução confirmada por log de agente seguro.";
  }
  if (validation.status === "execution_failed") {
    return "Execução confirmada com erro por log de agente seguro.";
  }
  return `Observação em andamento. O sistema aguardará novas coletas para verificar o aviso.${dueText}`;
};

export function formatAlertValue(alert) {
  if (alert.value === null || alert.value === undefined) return "Não informado";
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${alert.value}%`;
  if (alert.metric === "temperature") return `${alert.value} °C`;
  if (alert.metric === "availability" || alert.metric === "ping" || alert.metric === "service") {
    return alert.value === 0 ? "Indisponível" : String(alert.value);
  }
  return String(alert.value);
}

export function formatSuggestionCode(suggestion, index) {
  const date = new Date(suggestion.createdAt);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `AVISO-${year}-${String(index + 1).padStart(4, "0")}`;
}

export function getSuggestionMachineLabel(suggestion) {
  if (suggestion.hostName) return suggestion.hostName;
  if (suggestion.assetName) return suggestion.assetName;
  if (suggestion.assetId) return suggestion.assetId;
  const match = String(suggestion.title || "").match(/\bem\s+([A-Z0-9._-]+)$/i);
  return match?.[1] || "Máquina não vinculada";
}

export function formatAlertThreshold(alert) {
  if (alert.threshold === null || alert.threshold === undefined) return "Sem limite";
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${alert.threshold}%`;
  if (alert.metric === "temperature") return `${alert.threshold} °C`;
  return String(alert.threshold);
}

const percentThresholdAlertTypes = new Set(["cpu_high", "ram_high", "disk_high", "disk_health_low", "network_high"]);
const thresholdlessAlertTypes = new Set(["machine_offline", "ping_failure", "service_unavailable"]);
const durationlessAlertTypes = new Set(["disk_health_low", "machine_offline", "ping_failure", "service_unavailable"]);

export function isPercentThresholdRule(rule) {
  return percentThresholdAlertTypes.has(rule?.type);
}

export function isThresholdDisabled(rule) {
  return thresholdlessAlertTypes.has(rule?.type);
}

export function isDurationDisabled(rule) {
  return durationlessAlertTypes.has(rule?.type);
}

const alertCategoryByType = {
  ram_high: "Desempenho",
  cpu_high: "Desempenho",
  disk_high: "Armazenamento",
  disk_health_low: "Armazenamento",
  machine_offline: "Disponibilidade",
  network_high: "Segurança",
  temperature_high: "Ambiente físico",
  ping_failure: "Disponibilidade",
  service_unavailable: "Disponibilidade"
};

const alertImpactByType = {
  ram_high: "Lentidão, travamentos e risco de parada do atendimento.",
  cpu_high: "Processamento acima do esperado e degradação de desempenho.",
  disk_high: "Risco de indisponibilidade por falta de espaço.",
  disk_health_low: "Risco de perda de dados ou falha física do disco.",
  machine_offline: "Usuário ou serviço pode estar sem acesso ao equipamento.",
  network_high: "Possível instabilidade de comunicação ou saturação de rede.",
  temperature_high: "Risco físico ao equipamento por superaquecimento.",
  ping_failure: "Instabilidade de comunicação com o equipamento.",
  service_unavailable: "Serviço crítico indisponível para o usuário final."
};

const alertRecommendedActions = {
  ram_high: "Verificar processos em execução, reiniciar serviços pesados e avaliar expansão de memória.",
  cpu_high: "Identificar processo com alto consumo e validar se há tarefa travada.",
  disk_high: "Liberar espaço, mover arquivos temporários e avaliar limpeza preventiva.",
  disk_health_low: "Priorizar backup dos dados e avaliar troca preventiva do disco.",
  machine_offline: "Confirmar energia, rede e disponibilidade do equipamento antes de abrir atendimento.",
  network_high: "Validar tráfego incomum, portas ativas e uso de banda no segmento.",
  temperature_high: "Verificar ventilação, limpeza física e temperatura do ambiente.",
  ping_failure: "Validar cabo, Wi-Fi, switch e estabilidade do endereço IP.",
  service_unavailable: "Verificar serviço, dependências e logs antes de acionar manutenção."
};

const alertProbableCauses = {
  ram_high: "Aplicação pesada, vazamento de memória ou carga acima do normal.",
  cpu_high: "Processo travado, atualização em execução ou uso indevido de recursos.",
  disk_high: "Arquivos temporários, logs acumulados ou armazenamento insuficiente.",
  disk_health_low: "Desgaste do disco, setores instáveis ou falha iminente.",
  machine_offline: "Equipamento desligado, cabo desconectado, queda de rede ou IP indisponível.",
  network_high: "Backup, cópia de arquivos, atualização ou tráfego não esperado.",
  temperature_high: "Poeira, ventilação obstruída ou ambiente quente.",
  ping_failure: "Oscilação de rede, conflito de IP ou equipamento intermitente.",
  service_unavailable: "Serviço parado, dependência indisponível ou erro de configuração."
};

export function getAlertCategory(alert) {
  return alertCategoryByType[alert.type] || alertCategoryByType[alert.metric] || "Inventário";
}

export function getAlertImpact(alert) {
  return alertImpactByType[alert.type] || alertImpactByType[alert.metric] || "Pode afetar a operação do equipamento ou do setor.";
}

export function getAlertRecommendedAction(alert) {
  return alertRecommendedActions[alert.type] || alertRecommendedActions[alert.metric] || "Validar o equipamento e registrar análise técnica.";
}

export function getAlertProbableCause(alert) {
  return alertProbableCauses[alert.type] || alertProbableCauses[alert.metric] || "Evidência simulada ainda sem causa específica definida.";
}

export function getAlertConfidence(alert) {
  const occurrences = Number(alert.occurrencesCount || 0);
  if (occurrences >= 3 || alert.severity === "critical") return "Alta";
  if (occurrences >= 2) return "Média";
  return "Baixa";
}

export function getAlertTrend(alert) {
  const occurrences = Number(alert.occurrencesCount || 0);
  if (alert.status === "resolved") return "Normalizou";
  if (occurrences >= 3) return "Subindo";
  if (occurrences === 2) return "Oscilando";
  return "Estável";
}
