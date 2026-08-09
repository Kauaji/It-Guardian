import { formatDate } from "../../utils/display.js";

export const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_full: "Disco praticamente cheio",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

const compactAlertTypeLabels = {
  ram_high: "RAM alta",
  cpu_high: "CPU alta",
  disk_high: "Disco em alerta",
  disk_full: "Disco crítico",
  disk_health_low: "Saúde do disco baixa",
  machine_offline: "Máquina offline",
  network_high: "Rede em alerta",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha de ping",
  service_unavailable: "Serviço indisponível"
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
  inactiveAlertAutoResolveHours: 48,
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
    inactiveAlertAutoResolveHours: Math.max(
      1,
      Number(settings.inactiveAlertAutoResolveHours || defaultAlertOperationalSettings.inactiveAlertAutoResolveHours)
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

export function formatDisplayText(value, fallback = "Não informado") {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatDisplayText(item, ""))
      .filter(Boolean);
    return items.length ? items.join(", ") : fallback;
  }

  if (typeof value === "object") {
    const preferred = [
      value.summary,
      value.message,
      value.title,
      value.label,
      value.name,
      value.description,
      value.status,
      value.type,
      value.metric
    ].find((item) => item !== null && item !== undefined && item !== "");

    if (preferred !== undefined) {
      const version = value.version ? ` ${value.version}` : "";
      return `${formatDisplayText(preferred, fallback)}${version}`;
    }

    const facts = Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "" && typeof item !== "object")
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${formatDisplayText(item, "")}`)
      .filter((item) => !item.endsWith(": "));

    return facts.length ? facts.join(" · ") : fallback;
  }

  return String(value);
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
  const value = formatDisplayText(alert.value, "Não informado");
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${value}%`;
  if (alert.metric === "temperature") return `${value} °C`;
  if (alert.metric === "availability" || alert.metric === "ping" || alert.metric === "service") {
    return alert.value === 0 ? "Indisponível" : value;
  }
  return value;
}

export function formatSuggestionCode(suggestion, index) {
  const date = new Date(suggestion.createdAt);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `AVISO-${year}-${String(index + 1).padStart(4, "0")}`;
}

export function getSuggestionMachineLabel(suggestion) {
  if (suggestion.machineAlias) return formatDisplayText(suggestion.machineAlias);
  if (suggestion.hostName) return formatDisplayText(suggestion.hostName);
  if (suggestion.assetName) return formatDisplayText(suggestion.assetName);
  if (suggestion.assetId) return formatDisplayText(suggestion.assetId);
  const match = String(suggestion.title || "").match(/\bem\s+([A-Z0-9._-]+)$/i);
  return match?.[1] || "Máquina não vinculada";
}

export function getDeviceDisplayName(device) {
  const displayName = [
    device?.displayName,
    device?.machineAlias,
    device?.agent?.machineAlias,
    device?.name,
    device?.hostname,
    device?.agent?.hostname,
    device?.manualAsset?.hostname,
    device?.hardware?.hostname,
    device?.id
  ].find((value) => value !== null && value !== undefined && value !== "");

  return formatDisplayText(displayName, "Máquina não vinculada");
}

export function getDeviceIdentityValues(device) {
  return [
    device?.id,
    device?.displayName,
    device?.machineAlias,
    device?.agent?.machineAlias,
    device?.name,
    device?.hostname,
    device?.agent?.hostname,
    device?.manualAsset?.hostname,
    device?.hardware?.hostname
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value));
}

export function findSuggestionDevice(suggestion, devices = []) {
  const identifiers = [
    suggestion?.assetId,
    suggestion?.hostId,
    suggestion?.hostName,
    suggestion?.assetName,
    suggestion?.machineAlias,
    getSuggestionMachineLabel(suggestion)
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value));

  return devices.find((device) => {
    const deviceIdentifiers = getDeviceIdentityValues(device);
    return identifiers.some((identifier) => deviceIdentifiers.includes(identifier));
  }) || null;
}

export function getCompactAlertProblemLabel(suggestion) {
  const type = suggestion?.alertType || suggestion?.suggestedProblemTypeId;
  if (compactAlertTypeLabels[type]) return compactAlertTypeLabels[type];

  return formatDisplayText(suggestion?.title, "Aviso preventivo")
    .replace(/^Verifica\S+\s+preventiva:\s*/i, "")
    .replace(/\s+acima do limite\b/gi, " alta")
    .replace(/\s+em\s+[A-Z0-9._-]+$/i, "")
    .trim();
}

export function consolidateSuggestionsByMachine(suggestions = [], devices = []) {
  const priorityRank = { low: 0, medium: 1, high: 2, critical: 3 };
  const priorities = ["low", "medium", "high", "critical"];
  const grouped = new Map();

  suggestions.forEach((suggestion) => {
    const device = findSuggestionDevice(suggestion, devices);
    const fallbackLabel = getSuggestionMachineLabel(suggestion);
    const machineLabel = device ? getDeviceDisplayName(device) : fallbackLabel;
    const machineKey = normalizeText(
      device?.id ||
      suggestion?.assetId ||
      suggestion?.hostId ||
      suggestion?.hostName ||
      fallbackLabel
    );
    const group = grouped.get(machineKey) || {
      machineKey,
      machineLabel,
      device,
      members: []
    };

    group.members.push(suggestion);
    grouped.set(machineKey, group);
  });

  return Array.from(grouped.values()).map((group) => {
    const members = [...group.members].sort((left, right) => {
      const priorityDifference =
        (priorityRank[right.suggestedPriority] ?? 1) - (priorityRank[left.suggestedPriority] ?? 1);
      if (priorityDifference) return priorityDifference;
      return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    });
    const representative = members[0];
    const problemLabels = Array.from(new Set(members.map(getCompactAlertProblemLabel).filter(Boolean)));
    const occurrencesCount = members.reduce(
      (total, suggestion) => total + Math.max(1, Number(suggestion.occurrencesCount || 1)),
      0
    );
    const baseRank = members.reduce(
      (highest, suggestion) => Math.max(highest, priorityRank[suggestion.suggestedPriority] ?? 1),
      0
    );
    const recurrencePressure = occurrencesCount >= 3 ? 1 : 0;
    const escalatedRank = Math.min(3, baseRank + Math.max(0, problemLabels.length - 1) + recurrencePressure);
    const visibleProblems = problemLabels.slice(0, 3);
    const hiddenProblemCount = Math.max(0, problemLabels.length - visibleProblems.length);
    const summary = [
      visibleProblems.join(" + "),
      hiddenProblemCount ? `+${hiddenProblemCount}` : ""
    ].filter(Boolean).join(" ");
    const scriptValidations = members
      .flatMap((suggestion) => suggestion.scriptValidations || suggestion.validations || [])
      .filter(Boolean);

    return {
      ...representative,
      aggregationKey: group.machineKey,
      machineAlias: group.machineLabel,
      title: `${summary || "Aviso preventivo"} em ${group.machineLabel}`,
      suggestedPriority: priorities[escalatedRank],
      occurrencesCount,
      problemCount: problemLabels.length,
      problemLabels,
      memberSuggestionIds: members.map((suggestion) => suggestion.id),
      memberSuggestions: members,
      scriptValidations,
      createdAt: members.reduce((oldest, suggestion) => {
        const date = suggestion.createdAt || oldest;
        return !oldest || new Date(date) < new Date(oldest) ? date : oldest;
      }, ""),
      updatedAt: members.reduce((newest, suggestion) => {
        const date = suggestion.updatedAt || suggestion.createdAt || newest;
        return !newest || new Date(date) > new Date(newest) ? date : newest;
      }, "")
    };
  });
}

export function formatCompactSuggestionTitle(suggestion, machineLabel) {
  const displayMachineLabel = formatDisplayText(machineLabel, "Máquina não vinculada");

  if (Array.isArray(suggestion.problemLabels) && suggestion.problemLabels.length) {
    const visibleProblems = suggestion.problemLabels.slice(0, 3).map((problem) => formatDisplayText(problem, "Aviso"));
    const hiddenProblemCount = Math.max(0, suggestion.problemLabels.length - visibleProblems.length);
    return `${visibleProblems.join(" + ")}${hiddenProblemCount ? ` +${hiddenProblemCount}` : ""} em ${displayMachineLabel}`;
  }

  const type = suggestion.alertType || suggestion.suggestedProblemTypeId;
  const compactLabel = compactAlertTypeLabels[type];
  if (compactLabel) return `${compactLabel} em ${displayMachineLabel}`;

  const title = formatDisplayText(suggestion.title, "Aviso preventivo")
    .replace(/^Verifica\S+\s+preventiva:\s*/i, "")
    .replace(/\s+acima do limite\b/gi, " alta");
  const originalName = String(suggestion.hostName || "");
  return originalName && originalName !== displayMachineLabel
    ? title.split(originalName).join(displayMachineLabel)
    : title;
}

export function formatAlertThreshold(alert) {
  if (alert.threshold === null || alert.threshold === undefined) return "Sem limite";
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${alert.threshold}%`;
  if (alert.metric === "temperature") return `${alert.threshold} °C`;
  return String(alert.threshold);
}

const percentThresholdAlertTypes = new Set([
  "cpu_high",
  "ram_high",
  "disk_high",
  "disk_full",
  "disk_health_low",
  "network_high"
]);
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
  disk_full: "Armazenamento",
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
  disk_full: "Risco imediato de falha em gravações, atualizações e serviços.",
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
  disk_full: "Liberar espaço imediatamente e identificar arquivos, logs ou backups em crescimento.",
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
  disk_full: "Armazenamento esgotado por arquivos, logs, cache ou backups locais.",
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
