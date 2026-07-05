import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import {
  findAlertById,
  findServiceOrderSuggestionById,
  getAlertSettings,
  markSuggestionValidated
} from "./alertRepository.js";
import { addLog } from "./logRepository.js";
import { addServiceOrderHistory } from "./serviceOrderRepository.js";

export const scriptTypes = new Set(["bat", "cmd", "powershell", "shell", "other"]);
export const riskLevels = new Set(["low", "medium", "high", "critical"]);
export const simulationModes = new Set(["simulated", "prepared"]);
export const validationStatuses = new Set([
  "waiting_agent",
  "prepared",
  "observation_pending",
  "observed_resolved",
  "observed_persistent",
  "execution_confirmed",
  "execution_success",
  "execution_failed",
  "validation_cancelled",
  "insufficient_data",
  // Compatibilidade com registros antigos.
  "pending_validation",
  "validation_success",
  "validation_failed"
]);
export const allowedScriptVariables = new Map([
  ["CURRENT_USER", "Usuário logado na máquina atendida"],
  ["USER_PROFILE", "Caminho do perfil do usuário logado"],
  ["TEMP_DIR", "Pasta temporária do usuário"],
  ["HOSTNAME", "Nome da máquina"],
  ["ASSET_NAME", "Nome do ativo no IT Guardian"],
  ["ASSET_IP", "IP do ativo no IT Guardian"],
  ["OS_DRIVE", "Unidade do sistema operacional"],
  ["PROGRAM_DATA", "Pasta ProgramData do Windows"]
]);

const maxLengths = {
  name: 120,
  description: 500,
  content: 10000,
  category: 80,
  alertType: 80,
  problemType: 120,
  notes: 1000,
  listItem: 80
};

const riskRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const analysisPatterns = [
  {
    id: "critical-disk-format",
    risk: "critical",
    patterns: [/\bformat\b/i, /\bdiskpart\b/i, /\bremove-partition\b/i, /\bmkfs\b/i, /\bfdisk\b/i],
    action: "Possível alteração destrutiva em disco ou partição.",
    summary: "Pode conter comandos relacionados a formatação, particionamento ou remoção de partições."
  },
  {
    id: "file-removal",
    risk: "high",
    patterns: [/\bdel\b/i, /\berase\b/i, /\bremove-item\b/i, /\brm\s+-/i],
    action: "Possível remoção de arquivos.",
    summary: "Pode conter comandos de remoção de arquivos ou diretórios."
  },
  {
    id: "registry-change",
    risk: "high",
    patterns: [/\breg\s+add\b/i, /\breg\s+delete\b/i, /\bset-itemproperty\b/i, /\bnew-itemproperty\b/i],
    action: "Possível alteração no Registro ou em propriedades do sistema.",
    summary: "Pode alterar configurações do Registro do Windows ou propriedades do sistema."
  },
  {
    id: "service-control",
    risk: "high",
    patterns: [
      /\bnet\s+stop\b/i,
      /\bnet\s+start\b/i,
      /\brestart-service\b/i,
      /\bstop-service\b/i,
      /\bstart-service\b/i,
      /\bsystemctl\s+restart\b/i
    ],
    action: "Possível parada, inicialização ou reinício de serviço.",
    summary: "Pode alterar o estado de serviços do sistema."
  },
  {
    id: "shutdown-restart",
    risk: "high",
    patterns: [/\bshutdown\b/i, /\brestart-computer\b/i, /\bstop-computer\b/i, /\breboot\b/i],
    action: "Possível reinício ou desligamento de máquina.",
    summary: "Pode conter instruções de reinício ou desligamento."
  },
  {
    id: "flush-dns",
    risk: "medium",
    patterns: [/\bipconfig\s+\/flushdns\b/i, /\bclear-dnsclientcache\b/i],
    action: "Limpeza de cache DNS.",
    summary: "Aparenta limpar o cache DNS."
  },
  {
    id: "temporary-cleanup",
    risk: "medium",
    patterns: [/%temp%/i, /\btemp\b/i, /\btemporary\b/i, /\bcleanmgr\b/i, /\/tmp/i],
    action: "Possível limpeza de arquivos temporários.",
    summary: "Aparenta atuar sobre arquivos temporários ou limpeza local."
  },
  {
    id: "system-info",
    risk: "low",
    patterns: [/\bsysteminfo\b/i, /\bget-computerinfo\b/i, /\bhostname\b/i, /\bwhoami\b/i, /\bdf\s+-h\b/i, /\bget-volume\b/i],
    action: "Coleta de informações básicas.",
    summary: "Aparenta coletar informações básicas da máquina."
  },
  {
    id: "html-script-text",
    risk: "medium",
    patterns: [/<script\b/i, /<\/script>/i],
    action: "Conteúdo contém marcação de script em texto.",
    summary: "Contém marcação semelhante a HTML/script; será mantido apenas como texto escapado."
  }
];

const logErrorPatterns = [
  {
    type: "access_denied",
    patterns: [/access\s+denied/i, /acesso\s+negado/i, /permission\s+denied/i],
    summary: "O log indica acesso negado.",
    cause: "O script tentou acessar um recurso sem permissao suficiente.",
    solution: "Validar permissao administrativa, caminho acessado e credenciais do usuario."
  },
  {
    type: "file_not_found",
    patterns: [/file\s+not\s+found/i, /arquivo\s+n[aã]o\s+encontrado/i, /cannot\s+find/i],
    summary: "O arquivo ou recurso informado nao foi encontrado.",
    cause: "O caminho pode estar incorreto ou o arquivo nao existe no ativo.",
    solution: "Conferir caminho, nome do arquivo e existencia do recurso antes de tentar novamente."
  },
  {
    type: "invalid_path",
    patterns: [/invalid\s+path/i, /caminho\s+inv[aá]lido/i, /path\s+not\s+valid/i],
    summary: "O caminho informado parece invalido.",
    cause: "Variavel, unidade ou pasta informada nao foi resolvida corretamente.",
    solution: "Validar a unidade, remover caracteres invalidos e conferir variaveis do script."
  },
  {
    type: "insufficient_permission",
    patterns: [/insufficient\s+permission/i, /permiss[aã]o\s+insuficiente/i, /requires\s+elevation/i],
    summary: "Permissao insuficiente para concluir a acao.",
    cause: "A verificacao exigiria permissao elevada no ativo.",
    solution: "Registrar acao corretiva para revisar permissao, perfil do usuario ou agente seguro."
  },
  {
    type: "command_not_recognized",
    patterns: [/not\s+recognized/i, /n[aã]o\s+reconhecido/i, /command\s+not\s+found/i],
    summary: "Comando nao reconhecido no ambiente informado.",
    cause: "O comando pode nao existir no sistema operacional ou no PATH do ativo.",
    solution: "Validar tipo de script, shell alvo e comandos disponiveis no ativo."
  },
  {
    type: "timeout",
    patterns: [/timeout/i, /timed\s+out/i, /tempo\s+esgotado/i],
    summary: "A operacao atingiu o tempo limite.",
    cause: "O ativo pode estar indisponivel, lento ou sem resposta do agente.",
    solution: "Revisar conectividade, disponibilidade do agente e janela de execucao."
  },
  {
    type: "network_failure",
    patterns: [/network\s+failure/i, /falha\s+de\s+rede/i, /unreachable/i, /host\s+inacess/i],
    summary: "Falha de rede durante a verificacao.",
    cause: "O ativo, rota ou servico de rede pode estar indisponivel.",
    solution: "Validar conectividade, DNS, rota e disponibilidade do equipamento."
  },
  {
    type: "agent_unavailable",
    patterns: [/agent\s+unavailable/i, /agente\s+indispon/i, /agent\s+offline/i],
    summary: "Agente seguro indisponivel.",
    cause: "Nao ha agente conectado para executar ou coletar dados reais.",
    solution: "Manter a validacao como preparada e instalar/ativar agente seguro futuramente."
  },
  {
    type: "unresolved_variable",
    patterns: [/\{\{[A-Z0-9_]+\}\}/i, /unresolved\s+variable/i, /vari[aá]vel\s+n[aã]o\s+resolvida/i],
    summary: "Variavel do script nao foi resolvida.",
    cause: "O contexto do ativo nao forneceu uma das variaveis esperadas.",
    solution: "Conferir variaveis suportadas e dados cadastrados do ativo."
  },
  {
    type: "logged_user_not_detected",
    patterns: [/logged\s+user\s+not\s+detected/i, /usuario\s+logado\s+n[aã]o\s+detectado/i, /whoami.*failed/i],
    summary: "Usuario logado nao detectado.",
    cause: "A verificacao depende de sessao de usuario, mas o agente nao encontrou uma sessao ativa.",
    solution: "Confirmar se ha usuario logado no ativo ou ajustar o roteiro para contexto de sistema."
  }
];

const logErrorMetadata = {
  access_denied: {
    code: "ACCESS_DENIED",
    category: "permissao",
    severity: "high",
    requiresAdmin: true,
    requiresLoggedUser: false
  },
  file_not_found: {
    code: "FILE_NOT_FOUND",
    category: "arquivo",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  invalid_path: {
    code: "INVALID_PATH",
    category: "caminho",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  insufficient_permission: {
    code: "INSUFFICIENT_PERMISSION",
    category: "permissao",
    severity: "high",
    requiresAdmin: true,
    requiresLoggedUser: false
  },
  command_not_recognized: {
    code: "COMMAND_NOT_RECOGNIZED",
    category: "ambiente",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  timeout: {
    code: "TIMEOUT",
    category: "tempo_limite",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  network_failure: {
    code: "NETWORK_FAILURE",
    category: "rede",
    severity: "high",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  agent_unavailable: {
    code: "AGENT_UNAVAILABLE",
    category: "agente",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  unresolved_variable: {
    code: "UNRESOLVED_VARIABLE",
    category: "variavel",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  logged_user_not_detected: {
    code: "LOGGED_USER_NOT_DETECTED",
    category: "sessao_usuario",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: true
  }
};

const defaultMaintenanceScripts = [
  {
    id: "demo-script-network-diagnostics",
    name: "Diagnóstico básico de rede",
    description: "Roteiro seguro para registrar uma verificação de rede em atendimento.",
    type: "powershell",
    content: [
      "# Simulação de diagnóstico de rede",
      "hostname",
      "ipconfig /all",
      "Test-NetConnection"
    ].join("\n"),
    category: "Rede",
    riskLevel: "low",
    alertType: "ping_failure",
    problemType: "Internet lenta",
    tags: ["rede", "offline", "ping", "conectividade"],
    relatedAlertTypes: ["ping_failure", "network"],
    relatedProblemTypes: ["Internet lenta", "Maquina offline"],
    recommendedForCategories: ["Rede"]
  },
  {
    id: "demo-script-system-info",
    name: "Coleta básica do sistema",
    description: "Coleta textual de informações para triagem técnica.",
    type: "powershell",
    content: [
      "# Simulação de coleta de informações",
      "hostname",
      "whoami",
      "systeminfo"
    ].join("\n"),
    category: "Sistema",
    riskLevel: "low",
    alertType: "resource_threshold",
    problemType: "Sistema travando",
    tags: ["sistema", "cpu", "ram", "memoria", "desempenho"],
    relatedAlertTypes: ["resource_threshold", "cpu", "memory", "ram"],
    relatedProblemTypes: ["Sistema travando"],
    recommendedForCategories: ["Sistema", "Hardware"]
  },
  {
    id: "demo-script-printer-check",
    name: "Verificação de impressora",
    description: "Roteiro seguro para registrar checagem de impressora e fila.",
    type: "powershell",
    content: [
      "# Simulação de verificação de impressora",
      "Get-Printer",
      "Get-Service Spooler"
    ].join("\n"),
    category: "Impressora",
    riskLevel: "low",
    alertType: "recurring_failure",
    problemType: "Impressora não imprime"
  },
  {
    id: "demo-script-disk-check",
    name: "Verificação de disco",
    description: "Roteiro seguro para registrar avaliação inicial de disco.",
    type: "powershell",
    content: [
      "# Simulação de verificação de disco",
      "Get-Volume",
      "Get-PhysicalDisk"
    ].join("\n"),
    category: "Hardware",
    riskLevel: "medium",
    alertType: "disk_usage",
    problemType: "Disco acima do limite",
    tags: ["disco", "armazenamento", "hardware"],
    relatedAlertTypes: ["disk_usage", "disk"],
    relatedProblemTypes: ["Disco acima do limite"],
    recommendedForCategories: ["Hardware"]
  }
];

function trimString(value, maxLength, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function parseArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return trimmed.split(",");
      }
    }
    return trimmed.split(",");
  }
  return [];
}

function normalizeTextList(value) {
  return [...new Set(parseArrayValue(value)
    .map((item) => trimString(item, maxLengths.listItem))
    .filter(Boolean))];
}

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, " ")
    .trim();
}

function normalizeTokenList(value) {
  return parseArrayValue(value)
    .map(normalizeComparableText)
    .filter(Boolean);
}

function buildRecommendationContext(context = {}) {
  const tags = normalizeTokenList(context.tags);
  const technicalCategory = context.technicalCategory || inferTechnicalCategory(context);
  const fields = [
    context.alertType,
    context.metric,
    context.category,
    technicalCategory,
    context.severity,
    context.priority,
    context.title,
    context.description,
    context.probableCause,
    context.recommendedAction,
    context.problemType,
    context.assetType,
    context.operatingSystem,
    context.segmentName,
    context.groupName,
    ...tags
  ];
  const text = normalizeComparableText(fields.filter(Boolean).join(" "));

  return {
    ...context,
    normalizedText: text,
    alertType: normalizeComparableText(context.alertType),
    metric: normalizeComparableText(context.metric),
    category: normalizeComparableText(context.category),
    technicalCategory: normalizeComparableText(technicalCategory),
    severity: normalizeComparableText(context.severity),
    priority: normalizeComparableText(context.priority),
    problemType: normalizeComparableText(context.problemType),
    assetType: normalizeComparableText(context.assetType),
    operatingSystem: normalizeComparableText(context.operatingSystem),
    segmentName: normalizeComparableText(context.segmentName),
    groupName: normalizeComparableText(context.groupName),
    tags
  };
}

export function inferTechnicalCategory(source = {}) {
  const text = normalizeComparableText([
    source.alertType,
    source.metric,
    source.title,
    source.description,
    source.problemType,
    source.probableCause,
    source.recommendedAction,
    source.technicalCategory,
    source.category
  ].filter(Boolean).join(" "));

  if (/(disco|disk|storage|hd|ssd)/.test(text)) return "Armazenamento";
  if (/(ram|memoria|memory)/.test(text)) return "Memoria";
  if (/(cpu|processador)/.test(text)) return "Processamento";
  if (/(rede|network|ping|offline|indisponivel)/.test(text)) return "Rede";
  if (/(impressora|printer)/.test(text)) return "Impressoras";
  if (/(servico|service)/.test(text)) return "Servicos";
  return source.technicalCategory || source.category || "";
}

function matchesContextValue(values, candidates) {
  return values.some((value) =>
    candidates.some((candidate) => candidate && (value === candidate || candidate.includes(value) || value.includes(candidate)))
  );
}

export function scoreMaintenanceScriptForContext(script = {}, context = {}) {
  if (!script || script.active === false) return null;

  const normalized = buildRecommendationContext(context);
  const relatedAlertTypes = normalizeTokenList(script.relatedAlertTypes);
  const relatedProblemTypes = normalizeTokenList(script.relatedProblemTypes);
  const recommendedForCategories = normalizeTokenList(script.recommendedForCategories);
  const tags = normalizeTokenList(script.tags);
  const scriptFields = normalizeComparableText([
    script.name,
    script.description,
    script.category,
    script.alertType,
    script.problemType,
    script.estimatedSummary,
    ...tags,
    ...relatedAlertTypes,
    ...relatedProblemTypes,
    ...recommendedForCategories
  ].filter(Boolean).join(" "));
  const compatibilityWarnings = [];
  const reasons = [];
  let score = 0;

  const scriptAlertType = normalizeComparableText(script.alertType);
  if (
    normalized.alertType &&
    (scriptAlertType === normalized.alertType || relatedAlertTypes.includes(normalized.alertType))
  ) {
    score += 40;
    reasons.push("tipo de aviso compatível");
  }

  if (
    normalized.problemType &&
    (normalizeComparableText(script.problemType) === normalized.problemType || relatedProblemTypes.includes(normalized.problemType))
  ) {
    score += 35;
    reasons.push("tipo de problema compatível");
  }

  const scriptCategory = normalizeComparableText(script.category);
  if (
    normalized.technicalCategory &&
    (scriptCategory === normalized.technicalCategory || recommendedForCategories.includes(normalized.technicalCategory))
  ) {
    score += 25;
    reasons.push("categoria compatível");
  }

  const tagMatches = tags.filter((tag) =>
    tag && (normalized.normalizedText.includes(tag) || normalized.tags.includes(tag))
  );
  if (tagMatches.length) {
    score += tagMatches.length * 10;
    reasons.push(`tags relacionadas: ${tagMatches.slice(0, 3).join(", ")}`);
  }

  if (normalized.assetType && scriptFields.includes(normalized.assetType)) {
    score += 20;
    reasons.push("tipo de ativo compativel");
  }

  if (normalized.operatingSystem && scriptFields.includes(normalized.operatingSystem)) {
    score += 20;
    reasons.push("sistema operacional compativel");
  }

  const keywordMatches = [
    "disco",
    "ram",
    "memoria",
    "cpu",
    "rede",
    "offline",
    "ping",
    "impressora",
    "servico",
    "temperatura"
  ].filter((keyword) => normalized.normalizedText.includes(keyword) && scriptFields.includes(keyword));
  if (keywordMatches.length) {
    score += keywordMatches.length * 5;
    reasons.push(`palavras-chave: ${keywordMatches.slice(0, 3).join(", ")}`);
  }

  const supportedSystems = normalizeTokenList(script.supportedOperatingSystems || script.operatingSystems);
  if (normalized.operatingSystem && supportedSystems.length && !matchesContextValue(supportedSystems, [normalized.operatingSystem])) {
    return null;
  }

  if (script.requiresAdmin) {
    compatibilityWarnings.push("Pode exigir permissão administrativa em execução futura.");
  }
  if (script.requiresLoggedUser) {
    compatibilityWarnings.push("Pode exigir usuário logado no ativo em execução futura.");
  }
  if (["high", "critical"].includes(normalizeRiskLevel(script.riskLevel, "medium"))) {
    compatibilityWarnings.push("Script de risco elevado: revisar antes de usar.");
    score = Math.max(0, score - 5);
  }

  return {
    ...script,
    recommendationScore: score,
    recommendationReason: reasons.length
      ? `Recomendado por ${reasons.join("; ")}.`
      : "Sem correspondência forte com o contexto do aviso.",
    compatibilityWarnings,
    isRecommended: score > 0
  };
}

export function recommendMaintenanceScripts(context = {}, scripts = []) {
  const scored = scripts
    .map((script) => scoreMaintenanceScriptForContext(script, context))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.recommendationScore !== left.recommendationScore) {
        return right.recommendationScore - left.recommendationScore;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });

  return {
    recommended: scored.filter((script) => script.isRecommended),
    others: scored.filter((script) => !script.isRecommended)
  };
}

function normalizeVariableList(value) {
  return [...new Set(parseArrayValue(value)
    .map((item) => trimString(item, maxLengths.listItem).replace(/[{}]/g, "").toUpperCase())
    .filter((item) => allowedScriptVariables.has(item)))];
}

function detectScriptVariables(content = "") {
  const matches = [...String(content || "").matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/gi)];
  const variables = [...new Set(matches.map((match) => match[1].toUpperCase()))];
  const allowed = variables.filter((variable) => allowedScriptVariables.has(variable));
  const unknown = variables.filter((variable) => !allowedScriptVariables.has(variable));

  return {
    variables,
    allowed,
    unknown,
    details: allowed.map((variable) => ({
      name: `{{${variable}}}`,
      key: variable,
      description: allowedScriptVariables.get(variable)
    })),
    status: unknown.length ? "invalid" : "valid"
  };
}

function normalizeScriptType(value) {
  const type = String(value || "other").trim().toLowerCase();
  return scriptTypes.has(type) ? type : "other";
}

function normalizeRiskLevel(value, fallback = "medium") {
  const risk = String(value || fallback).trim().toLowerCase();
  return riskLevels.has(risk) ? risk : fallback;
}

function chooseHigherRisk(current, candidate) {
  return riskRank[candidate] > riskRank[current] ? candidate : current;
}

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function fromScriptRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    type: row.type,
    content: row.content,
    estimatedSummary: row.estimated_summary || "",
    category: row.category || "",
    riskLevel: row.risk_level,
    suggestedRiskLevel: row.suggested_risk_level,
    requiresConfirmation: row.requires_confirmation,
    active: row.active,
    alertType: row.alert_type || "",
    problemType: row.problem_type || "",
    tags: parseArrayValue(row.tags),
    supportedVariables: parseArrayValue(row.supported_variables),
    relatedAlertTypes: parseArrayValue(row.related_alert_types),
    relatedProblemTypes: parseArrayValue(row.related_problem_types),
    recommendedForCategories: parseArrayValue(row.recommended_for_categories),
    requiresLoggedUser: row.requires_logged_user === true,
    requiresAdmin: row.requires_admin === true,
    safePreview: row.safe_preview || row.content || "",
    variableValidationStatus: row.variable_validation_status || "valid",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromLogRow(row) {
  return {
    id: row.id,
    scriptId: row.script_id,
    assetId: row.asset_id,
    serviceOrderId: row.service_order_id,
    alertId: row.alert_id,
    suggestionId: row.suggestion_id,
    preventivePlanId: row.preventive_plan_id,
    mode: row.mode,
    status: row.status,
    executedBy: row.executed_by,
    executedAt: row.executed_at,
    notes: row.notes || "",
    rawLog: row.raw_log || "",
    parsedSummary: row.parsed_summary || "",
    errorDetected: row.error_detected === true,
    errorType: row.error_type || "",
    errorCode: row.error_code || "",
    errorCategory: row.error_category || "",
    errorSeverity: row.error_severity || "",
    probableCause: row.probable_cause || "",
    suggestedSolution: row.suggested_solution || "",
    requiresAdmin: row.requires_admin === true,
    requiresLoggedUser: row.requires_logged_user === true,
    attentionRequired: row.attention_required === true,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    correctiveActionStatus: row.corrective_action_status || "",
    correctiveActionNotes: row.corrective_action_notes || "",
    createdAt: row.created_at
  };
}

function fromValidationRow(row) {
  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    alertId: row.alert_id,
    assetId: row.asset_id,
    scriptId: row.script_id,
    scriptName: row.script_name || "",
    status: row.status,
    startedBy: row.started_by,
    startedAt: row.started_at,
    validationWindowMinutes: Number(row.validation_window_minutes || 30),
    validationDueAt: row.validation_due_at,
    finishedAt: row.finished_at,
    resultSummary: row.result_summary || "",
    logId: row.log_id,
    idempotencyKey: row.idempotency_key || null,
    observationSlot: row.observation_slot || null,
    activeKey: row.active_key || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function interpretScriptLogWithMetadata(rawLog = "", fallbackStatus = "registered") {
  const text = String(rawLog || "").trim();

  if (!text) {
    return {
      parsedSummary: "Nenhum log de script disponível.",
      errorDetected: false,
      errorType: "",
      errorCode: "",
      errorCategory: "",
      errorSeverity: "",
      probableCause: "",
      suggestedSolution: "",
      requiresAdmin: false,
      requiresLoggedUser: false,
      status: fallbackStatus
    };
  }

  for (const rule of logErrorPatterns) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    const metadata = logErrorMetadata[rule.type] || {};

    return {
      parsedSummary: rule.summary,
      errorDetected: true,
      errorType: rule.type,
      errorCode: metadata.code || "",
      errorCategory: metadata.category || "",
      errorSeverity: metadata.severity || "medium",
      probableCause: rule.cause,
      suggestedSolution: rule.solution,
      requiresAdmin: metadata.requiresAdmin === true,
      requiresLoggedUser: metadata.requiresLoggedUser === true,
      status: "error"
    };
  }

  return {
    parsedSummary: "Log registrado sem erro reconhecido.",
    errorDetected: false,
    errorType: "",
    errorCode: "",
    errorCategory: "",
    errorSeverity: "",
    probableCause: "",
    suggestedSolution: "",
    requiresAdmin: false,
    requiresLoggedUser: false,
    status: fallbackStatus === "error" ? "registered" : fallbackStatus
  };
}

export function analyzeMaintenanceScriptContent(content = "") {
  const text = String(content ?? "").slice(0, maxLengths.content);
  const variableInfo = detectScriptVariables(text);
  const allowedVariables = Array.from(allowedScriptVariables.entries()).map(([key, description]) => ({
    key,
    name: `{{${key}}}`,
    description
  }));
  const detectedActions = [];
  const summaryParts = [];
  let suggestedRiskLevel = "low";

  for (const rule of analysisPatterns) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    detectedActions.push(rule.action);
    summaryParts.push(rule.summary);
    suggestedRiskLevel = chooseHigherRisk(suggestedRiskLevel, rule.risk);
  }

  if (!text.trim()) {
    return {
      estimatedSummary: "Nenhum conteúdo informado para análise estimada.",
      suggestedRiskLevel: "medium",
      detectedActions: [],
      detectedVariables: [],
      unknownVariables: [],
      variableDetails: [],
      variableValidationStatus: "valid",
      allowedVariables,
      safePreview: "",
      safetyWarnings: [
        "Nenhum comando foi executado.",
        "O conteúdo é tratado apenas como texto armazenado."
      ]
    };
  }

  return {
    estimatedSummary: summaryParts.length
      ? [...new Set(summaryParts)].join(" ")
      : "Não foram identificados padrões conhecidos de alto risco. Ainda assim, revise manualmente antes de usar.",
    suggestedRiskLevel,
    detectedActions: [...new Set(detectedActions)],
    detectedVariables: variableInfo.allowed.map((variable) => `{{${variable}}}`),
    unknownVariables: variableInfo.unknown.map((variable) => `{{${variable}}}`),
    variableDetails: variableInfo.details,
    variableValidationStatus: variableInfo.status,
    allowedVariables,
    safePreview: text,
    safetyWarnings: [
      "Resumo estimado gerado a partir de padrões conhecidos. Revise manualmente antes de usar.",
      "Nenhum comando foi executado.",
      "O conteúdo do script não é interpretado pelo sistema."
    ]
  };
}

function normalizeScriptPayload(payload = {}, current = {}) {
  const name = trimString(payload.name ?? current.name, maxLengths.name);
  const content = String(payload.content ?? current.content ?? "").slice(0, maxLengths.content);

  if (!name || name.length < 3) {
    const error = new Error("Informe um nome de script com pelo menos 3 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (!content.trim()) {
    const error = new Error("Informe o conteúdo do script como texto.");
    error.statusCode = 400;
    throw error;
  }

  const analysis = analyzeMaintenanceScriptContent(content);
  if (analysis.unknownVariables?.length) {
    const error = new Error(`Variaveis nao permitidas no script: ${analysis.unknownVariables.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
  const suggestedRiskLevel = normalizeRiskLevel(
    payload.suggestedRiskLevel ?? current.suggestedRiskLevel,
    analysis.suggestedRiskLevel
  );
  const tags = normalizeTextList(payload.tags ?? current.tags);
  const relatedAlertTypes = normalizeTextList(payload.relatedAlertTypes ?? current.relatedAlertTypes);
  const relatedProblemTypes = normalizeTextList(payload.relatedProblemTypes ?? current.relatedProblemTypes);
  const recommendedForCategories = normalizeTextList(payload.recommendedForCategories ?? current.recommendedForCategories);
  const supportedVariables = normalizeVariableList(payload.supportedVariables ?? current.supportedVariables);
  const detectedVariables = normalizeVariableList(analysis.detectedVariables);
  const finalSupportedVariables = [...new Set([...supportedVariables, ...detectedVariables])];

  return {
    name,
    description: trimString(payload.description ?? current.description, maxLengths.description),
    type: normalizeScriptType(payload.type ?? current.type),
    content,
    estimatedSummary: trimString(
      payload.estimatedSummary ?? current.estimatedSummary ?? analysis.estimatedSummary,
      maxLengths.content,
      analysis.estimatedSummary
    ),
    category: trimString(payload.category ?? current.category, maxLengths.category),
    riskLevel: normalizeRiskLevel(payload.riskLevel ?? current.riskLevel, suggestedRiskLevel),
    suggestedRiskLevel,
    requiresConfirmation: toBoolean(payload.requiresConfirmation ?? current.requiresConfirmation, true),
    active: toBoolean(payload.active ?? current.active, true),
    alertType: trimString(payload.alertType ?? current.alertType, maxLengths.alertType),
    problemType: trimString(payload.problemType ?? current.problemType, maxLengths.problemType),
    tags,
    supportedVariables: finalSupportedVariables,
    relatedAlertTypes,
    relatedProblemTypes,
    recommendedForCategories,
    requiresLoggedUser: toBoolean(payload.requiresLoggedUser ?? current.requiresLoggedUser, false),
    requiresAdmin: toBoolean(payload.requiresAdmin ?? current.requiresAdmin, false),
    safePreview: analysis.safePreview || content,
    variableValidationStatus: analysis.variableValidationStatus || "valid"
  };
}

export async function seedDefaultMaintenanceScripts() {
  for (const script of defaultMaintenanceScripts) {
    const analysis = analyzeMaintenanceScriptContent(script.content);
    const normalized = normalizeScriptPayload({
      ...script,
      estimatedSummary: analysis.estimatedSummary,
      suggestedRiskLevel: analysis.suggestedRiskLevel,
      requiresConfirmation: true,
      active: true
    });
    const existing = await query("SELECT id FROM maintenance_scripts WHERE id = $1", [script.id]);

    if (existing.rows.length) {
      await query(
        `
          UPDATE maintenance_scripts
          SET name = $2,
              description = $3,
              type = $4,
              content = $5,
              estimated_summary = $6,
              category = $7,
              risk_level = $8,
              suggested_risk_level = $9,
              requires_confirmation = TRUE,
              active = TRUE,
              alert_type = $10,
              problem_type = $11,
              tags = $12,
              supported_variables = $13,
              related_alert_types = $14,
              related_problem_types = $15,
              recommended_for_categories = $16,
              requires_logged_user = $17,
              requires_admin = $18,
              safe_preview = $19,
              variable_validation_status = $20,
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          script.id,
          normalized.name,
          normalized.description,
          normalized.type,
          normalized.content,
          normalized.estimatedSummary,
          normalized.category,
          normalized.riskLevel,
          normalized.suggestedRiskLevel,
          normalized.alertType || null,
          normalized.problemType || null,
          JSON.stringify(normalized.tags),
          JSON.stringify(normalized.supportedVariables),
          JSON.stringify(normalized.relatedAlertTypes),
          JSON.stringify(normalized.relatedProblemTypes),
          JSON.stringify(normalized.recommendedForCategories),
          normalized.requiresLoggedUser,
          normalized.requiresAdmin,
          normalized.safePreview,
          normalized.variableValidationStatus
        ]
      );
      continue;
    }

    await query(
      `
        INSERT INTO maintenance_scripts (
          id, name, description, type, content, estimated_summary, category,
          risk_level, suggested_risk_level, requires_confirmation, active,
          alert_type, problem_type, tags, supported_variables, related_alert_types,
          related_problem_types, recommended_for_categories, requires_logged_user,
          requires_admin, safe_preview, variable_validation_status, created_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, NULL
        )
      `,
      [
        script.id,
        normalized.name,
        normalized.description,
        normalized.type,
        normalized.content,
        normalized.estimatedSummary,
        normalized.category,
        normalized.riskLevel,
        normalized.suggestedRiskLevel,
        normalized.alertType || null,
        normalized.problemType || null,
        JSON.stringify(normalized.tags),
        JSON.stringify(normalized.supportedVariables),
        JSON.stringify(normalized.relatedAlertTypes),
        JSON.stringify(normalized.relatedProblemTypes),
        JSON.stringify(normalized.recommendedForCategories),
        normalized.requiresLoggedUser,
        normalized.requiresAdmin,
        normalized.safePreview,
        normalized.variableValidationStatus
      ]
    );
  }
}

export async function listMaintenanceScripts({ includeInactive = true } = {}) {
  const result = await query(
    `
      SELECT *
      FROM maintenance_scripts
      ${includeInactive ? "" : "WHERE active = TRUE"}
      ORDER BY active DESC, updated_at DESC, name ASC
    `
  );

  return result.rows.map(fromScriptRow);
}

export async function findMaintenanceScriptById(id) {
  const result = await query("SELECT * FROM maintenance_scripts WHERE id = $1", [id]);
  return result.rows[0] ? fromScriptRow(result.rows[0]) : null;
}

export async function createMaintenanceScript(payload = {}, user = null) {
  const normalized = normalizeScriptPayload(payload);
  const result = await query(
    `
      INSERT INTO maintenance_scripts (
        id, name, description, type, content, estimated_summary, category,
        risk_level, suggested_risk_level, requires_confirmation, active,
        alert_type, problem_type, tags, supported_variables, related_alert_types,
        related_problem_types, recommended_for_categories, requires_logged_user,
        requires_admin, safe_preview, variable_validation_status, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
      RETURNING *
    `,
    [
      randomUUID(),
      normalized.name,
      normalized.description,
      normalized.type,
      normalized.content,
      normalized.estimatedSummary,
      normalized.category,
      normalized.riskLevel,
      normalized.suggestedRiskLevel,
      normalized.requiresConfirmation,
      normalized.active,
      normalized.alertType || null,
      normalized.problemType || null,
      JSON.stringify(normalized.tags),
      JSON.stringify(normalized.supportedVariables),
      JSON.stringify(normalized.relatedAlertTypes),
      JSON.stringify(normalized.relatedProblemTypes),
      JSON.stringify(normalized.recommendedForCategories),
      normalized.requiresLoggedUser,
      normalized.requiresAdmin,
      normalized.safePreview,
      normalized.variableValidationStatus,
      user?.id || null
    ]
  );

  return fromScriptRow(result.rows[0]);
}

export async function updateMaintenanceScript(id, payload = {}) {
  const current = await findMaintenanceScriptById(id);
  if (!current) return null;
  const normalized = normalizeScriptPayload(payload, current);

  const result = await query(
    `
      UPDATE maintenance_scripts
      SET name = $2,
          description = $3,
          type = $4,
          content = $5,
          estimated_summary = $6,
          category = $7,
          risk_level = $8,
          suggested_risk_level = $9,
          requires_confirmation = $10,
          active = $11,
          alert_type = $12,
          problem_type = $13,
          tags = $14,
          supported_variables = $15,
          related_alert_types = $16,
          related_problem_types = $17,
          recommended_for_categories = $18,
          requires_logged_user = $19,
          requires_admin = $20,
          safe_preview = $21,
          variable_validation_status = $22,
          active_key = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      normalized.name,
      normalized.description,
      normalized.type,
      normalized.content,
      normalized.estimatedSummary,
      normalized.category,
      normalized.riskLevel,
      normalized.suggestedRiskLevel,
      normalized.requiresConfirmation,
      normalized.active,
      normalized.alertType || null,
      normalized.problemType || null,
      JSON.stringify(normalized.tags),
      JSON.stringify(normalized.supportedVariables),
      JSON.stringify(normalized.relatedAlertTypes),
      JSON.stringify(normalized.relatedProblemTypes),
      JSON.stringify(normalized.recommendedForCategories),
      normalized.requiresLoggedUser,
      normalized.requiresAdmin,
      normalized.safePreview,
      normalized.variableValidationStatus
    ]
  );

  return fromScriptRow(result.rows[0]);
}

export async function deactivateMaintenanceScript(id) {
  const result = await query(
    `
      UPDATE maintenance_scripts
      SET active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] ? fromScriptRow(result.rows[0]) : null;
}

export async function createScriptSimulationLog({
  scriptId,
  assetId = null,
  serviceOrderId = null,
  alertId = null,
  suggestionId = null,
  preventivePlanId = null,
  mode = "simulated",
  status = "registered",
  executedBy = null,
  notes = "",
  rawLog = "",
  parsedSummary = "",
  errorDetected = null,
  errorType = "",
  errorCode = "",
  errorCategory = "",
  errorSeverity = "",
  probableCause = "",
  suggestedSolution = "",
  requiresAdmin = null,
  requiresLoggedUser = null,
  attentionRequired = null,
  db = query
}) {
  const safeMode = simulationModes.has(mode) ? mode : "simulated";
  const interpreted = interpretScriptLogWithMetadata(rawLog, status);
  const hasError = errorDetected ?? interpreted.errorDetected;
  const result = await db(
    `
      INSERT INTO script_execution_logs (
        id, script_id, asset_id, service_order_id, alert_id, suggestion_id,
        preventive_plan_id, mode, status, executed_by, notes, raw_log,
        parsed_summary, error_detected, error_type, error_code, error_category,
        error_severity, probable_cause, suggested_solution, requires_admin,
        requires_logged_user, attention_required
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23
      )
      RETURNING *
    `,
    [
      randomUUID(),
      scriptId,
      assetId || null,
      serviceOrderId || null,
      alertId || null,
      suggestionId || null,
      preventivePlanId || null,
      safeMode,
      hasError ? "error" : (interpreted.status || status),
      executedBy || null,
      trimString(notes, maxLengths.notes),
      rawLog || "",
      parsedSummary || interpreted.parsedSummary,
      hasError,
      errorType || interpreted.errorType || null,
      errorCode || interpreted.errorCode || null,
      errorCategory || interpreted.errorCategory || null,
      errorSeverity || interpreted.errorSeverity || null,
      probableCause || interpreted.probableCause || null,
      suggestedSolution || interpreted.suggestedSolution || null,
      requiresAdmin ?? interpreted.requiresAdmin,
      requiresLoggedUser ?? interpreted.requiresLoggedUser,
      attentionRequired ?? hasError
    ]
  );

  return fromLogRow(result.rows[0]);
}

export async function registerMaintenanceScriptSimulation({ scriptId, payload = {}, user = null }) {
  const script = await findMaintenanceScriptById(scriptId);

  if (!script || script.active === false) {
    const error = new Error("Script de manutenção não encontrado ou inativo.");
    error.statusCode = 404;
    throw error;
  }

  if (payload.confirmed !== true) {
    const error = new Error("Confirme que esta ação registra apenas uma simulação. Nenhum comando será executado.");
    error.statusCode = 400;
    throw error;
  }

  const riskLevel = normalizeRiskLevel(script.riskLevel || script.suggestedRiskLevel, "medium");
  const requiresExtraConfirmation = riskLevel === "high" || riskLevel === "critical";

  if (requiresExtraConfirmation && payload.riskAcknowledged !== true) {
    const error = new Error("Scripts de alto risco exigem confirmação extra antes de registrar a simulação.");
    error.statusCode = 400;
    throw error;
  }

  const assetId = trimString(payload.assetId, 120);
  const serviceOrderId = trimString(payload.serviceOrderId, 120);
  const alertId = trimString(payload.alertId, 120);
  const notes = trimString(payload.notes, maxLengths.notes);
  const mode = simulationModes.has(payload.mode) ? payload.mode : "simulated";

  return await withTransaction(async (db) => {
    const log = await createScriptSimulationLog({
    scriptId: script.id,
    assetId,
    serviceOrderId,
    alertId,
    mode,
    status: "registered",
    executedBy: user?.id || null,
    notes,
    db
  });

  const userName = user?.name || "Usuário";
  const historySummary = [
    `Script: ${script.name}`,
    `Tipo: ${script.type}`,
    `Risco: ${riskLevel}`,
    `Resumo estimado: ${script.estimatedSummary || "Não informado"}`,
    notes ? `Observação: ${notes}` : "",
    "Nenhum comando foi executado."
  ].filter(Boolean).join("\n");

  if (assetId) {
    await addAssetHistory({
      assetId,
      eventType: "script_simulation",
      message: `Usuário ${userName} registrou simulação do script '${script.name}' no ativo ${assetId}. Nenhum comando foi executado.`,
      oldValue: null,
      newValue: historySummary,
      userId: user?.id || null,
      userName,
      db
    });
  }

  if (serviceOrderId) {
    await addServiceOrderHistory({
      serviceOrderId,
      eventType: "script_simulation",
      message: `Simulação de script registrada: ${script.name}. Nenhum comando foi executado.`,
      oldValue: null,
      newValue: historySummary,
      user,
      db
    });
  }

  await addLog({
    type: "maintenance_script_simulation",
    message: `Simulação registrada para o script ${script.name}. Nenhum comando foi executado.`,
    userId: user?.id || null,
    meta: {
      scriptId: script.id,
      assetId: assetId || null,
      serviceOrderId: serviceOrderId || null,
      alertId: alertId || null,
      mode,
      riskLevel
    },
    db
  });

    return { log, script };
  });
}

export async function listScriptValidationsForSuggestion(suggestionId) {
  const result = await query(
    `
      SELECT validations.*,
             scripts.name AS script_name
      FROM script_validation_runs validations
      LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
      WHERE validations.suggestion_id = $1
      ORDER BY validations.created_at DESC
    `,
    [suggestionId]
  );

  return result.rows.map(fromValidationRow);
}

async function findActiveScriptValidationForSuggestion(suggestionId, scriptId, db = query) {
  const result = await db(
    `
      SELECT validations.*,
             scripts.name AS script_name
      FROM script_validation_runs validations
      LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
      WHERE validations.suggestion_id = $1
        AND validations.script_id = $2
        AND validations.active_key IS NOT NULL
        AND validations.status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      ORDER BY validations.created_at DESC
      LIMIT 1
    `,
    [suggestionId, scriptId]
  );

  return result.rows[0] ? fromValidationRow(result.rows[0]) : null;
}

export function toRecommendedScriptResponse(script) {
  return {
    id: script.id,
    name: script.name,
    category: script.category,
    riskLevel: script.riskLevel,
    estimatedSummary: script.estimatedSummary,
    recommendationScore: script.recommendationScore || 0,
    recommendationReason: script.recommendationReason || "",
    compatibilityWarnings: script.compatibilityWarnings || [],
    requiresLoggedUser: script.requiresLoggedUser === true,
    requiresAdmin: script.requiresAdmin === true,
    supportedVariables: script.supportedVariables || [],
    isRecommended: script.isRecommended === true,
    matchedAssetIds: script.matchedAssetIds || [],
    matchedAlertIds: script.matchedAlertIds || []
  };
}

export async function listRecommendedScriptsForSuggestion(suggestionId) {
  const suggestion = await findServiceOrderSuggestionById(suggestionId);

  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }

  const [alert, scripts] = await Promise.all([
    suggestion.alertId ? findAlertById(suggestion.alertId) : null,
    listMaintenanceScripts({ includeInactive: false })
  ]);
  const context = {
    alertType: alert?.type || suggestion.suggestedProblemTypeId || "",
    metric: alert?.metric || "",
    category: "",
    technicalCategory: inferTechnicalCategory({
      alertType: alert?.type,
      metric: alert?.metric,
      title: suggestion.title || alert?.title,
      description: suggestion.description || alert?.description,
      problemType: suggestion.suggestedProblemTypeId
    }),
    severity: alert?.severity || "",
    priority: suggestion.suggestedPriority || "",
    title: suggestion.title || alert?.title || "",
    description: suggestion.description || alert?.description || "",
    probableCause: suggestion.probableCause || "",
    recommendedAction: suggestion.recommendedAction || "",
    problemType: suggestion.suggestedProblemTypeId || "",
    assetType: suggestion.assetType || "",
    operatingSystem: suggestion.operatingSystem || ""
  };
  const recommendations = recommendMaintenanceScripts(context, scripts);

  return {
    recommended: recommendations.recommended.map(toRecommendedScriptResponse),
    others: recommendations.others.map(toRecommendedScriptResponse)
  };
}

export async function useScriptFromSuggestion({ suggestionId, scriptId, payload = {}, user = null }) {
  const [suggestion, script, settings] = await Promise.all([
    findServiceOrderSuggestionById(suggestionId),
    findMaintenanceScriptById(scriptId),
    getAlertSettings()
  ]);

  if (!suggestion) {
    const error = new Error("Sugestão de OS não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  if (!["pending", "observed_persistent", "insufficient_data", "validation_cancelled"].includes(suggestion.status)) {
    const error = new Error("Apenas sugestões pendentes podem receber observação de script.");
    error.statusCode = 409;
    throw error;
  }
  if (!script || script.active === false) {
    const error = new Error("Script de manutenção não encontrado ou inativo.");
    error.statusCode = 404;
    throw error;
  }
  if (payload.confirmed !== true) {
    const error = new Error("Confirme que esta ação apenas registra o uso do script. Nenhum comando será executado.");
    error.statusCode = 400;
    throw error;
  }

  const riskLevel = normalizeRiskLevel(script.riskLevel || script.suggestedRiskLevel, "medium");
  if ((riskLevel === "high" || riskLevel === "critical") && payload.riskAcknowledged !== true) {
    const error = new Error("Scripts de alto risco exigem confirmação extra antes de registrar o uso.");
    error.statusCode = 400;
    throw error;
  }

  const validationWindowMinutes = Math.min(
    10080,
    Math.max(5, Math.round(Number(payload.validationWindowMinutes || settings.scriptValidationWindowMinutes || 30)))
  );
  const alert = suggestion.alertId ? await findAlertById(suggestion.alertId) : null;
  const assetId = suggestion.assetId || alert?.assetId || null;
  const userName = user?.name || "Usuário";
  const notes = trimString(payload.notes, maxLengths.notes);
  const validationDue = new Date(Date.now() + validationWindowMinutes * 60000);
  const activeKey = `${suggestion.id}:${script.id}`;
  const observationSlot = `${suggestion.id}:${script.id}:active`;
  const existingValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id);
  if (existingValidation) {
    const existingLog = existingValidation.logId ? await findScriptLogById(existingValidation.logId) : null;
    return { suggestion, script, log: existingLog, validation: existingValidation, reused: true };
  }
  const rawLog = [
    "Uso preparado a partir de sugestão de OS.",
    "Nenhum comando foi executado pelo servidor ou navegador.",
    "Aguardando agente seguro/coleta futura para observação real."
  ].join("\n");

  return await withTransaction(async (db) => {
    const duplicatedValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id, db);
    if (duplicatedValidation) {
      const duplicatedLog = duplicatedValidation.logId ? await findScriptLogById(duplicatedValidation.logId) : null;
      return { suggestion, script, log: duplicatedLog, validation: duplicatedValidation, reused: true };
    }

    const validationInsert = await db(
      `
        INSERT INTO script_validation_runs (
          id, suggestion_id, alert_id, asset_id, script_id, status, started_by,
          validation_window_minutes, validation_due_at, result_summary,
          idempotency_key, observation_slot, active_key
        )
        VALUES ($1, $2, $3, $4, $5, 'observation_pending', $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (active_key) DO NOTHING
        RETURNING *
      `,
      [
        randomUUID(),
        suggestion.id,
        suggestion.alertId || null,
        assetId,
        script.id,
        user?.id || null,
        validationWindowMinutes,
        validationDue.toISOString(),
        "Validação preparada. Nenhum comando foi executado nesta versão.",
        activeKey,
        observationSlot,
        activeKey
      ]
    );

    if (!validationInsert.rows[0]) {
      const reusedValidation = await findActiveScriptValidationForSuggestion(suggestion.id, script.id, db);
      const reusedLog = reusedValidation?.logId ? await findScriptLogById(reusedValidation.logId) : null;
      return { suggestion, script, log: reusedLog, validation: reusedValidation, reused: true };
    }

    const log = await createScriptSimulationLog({
      scriptId: script.id,
      assetId,
      alertId: suggestion.alertId,
      suggestionId: suggestion.id,
      mode: "prepared",
      status: "observation_pending",
      executedBy: user?.id || null,
      notes,
      rawLog,
      parsedSummary: "Observação preparada. O sistema aguardará a janela configurada antes de reavaliar o aviso.",
      errorDetected: false,
      attentionRequired: false,
      db
    });

    const validationResult = await db(
      `
        UPDATE script_validation_runs
        SET log_id = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [validationInsert.rows[0].id, log.id]
    );
    const validation = fromValidationRow({ ...validationResult.rows[0], script_name: script.name });

    if (assetId) {
      await addAssetHistory({
        assetId,
        eventType: "script_validation_started",
        message:
          `Script '${script.name}' foi registrado na sugestão ${suggestion.id}. ` +
          `Validação iniciada por ${userName}. Nenhum comando foi executado nesta versão.`,
        oldValue: null,
        newValue: `Janela: ${validationWindowMinutes} minuto(s). Validação prevista: ${validationDue.toISOString()}.`,
        userId: user?.id || null,
        userName,
        db
      });
    }

    await addLog({
      type: "script_validation_started",
      message: `Validação de script preparada para sugestão de OS: ${script.name}.`,
      userId: user?.id || null,
      meta: {
        suggestionId: suggestion.id,
        alertId: suggestion.alertId,
        assetId,
        scriptId: script.id,
        validationId: validation.id,
        validationWindowMinutes
      },
      db
    });

    return { suggestion, script, log, validation };
  });
}
export async function refreshDueScriptValidations(options = {}) {
  const result = await query(`
    SELECT validations.*,
           scripts.name AS script_name,
           alerts.status AS alert_status,
           alerts.title AS alert_title
    FROM script_validation_runs validations
    LEFT JOIN maintenance_scripts scripts ON scripts.id = validations.script_id
    LEFT JOIN alerts ON alerts.id = validations.alert_id
    WHERE validations.status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      AND validations.validation_due_at <= NOW()
    ORDER BY validations.validation_due_at ASC
  `);
  const refreshed = [];
  const summary = {
    dueCount: result.rows.length,
    updatedCount: 0,
    resolvedCount: 0,
    persistentCount: 0,
    insufficientDataCount: 0,
    failedValidationCount: 0,
    failedValidations: [],
    validations: refreshed
  };

  for (const row of result.rows) {
    try {
      let status = "insufficient_data";
      let resultSummary = "Não há coleta suficiente para concluir a observação. Nenhum comando foi executado.";

      if (row.alert_id && row.alert_status) {
        if (row.alert_status === "resolved") {
          status = "observed_resolved";
          resultSummary = "O aviso não voltou durante o período de observação. Não existe confirmação de execução do script.";
        } else {
          status = "observed_persistent";
          resultSummary = "O aviso continuou ativo durante o período de observação. Nenhum comando foi executado nesta versão.";
        }
      }

      await withTransaction(async (db) => {
        const updated = await db(
          `
            UPDATE script_validation_runs
            SET status = $2,
                finished_at = NOW(),
                result_summary = $3,
                active_key = NULL,
                updated_at = NOW()
            WHERE id = $1
              AND status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
            RETURNING *
          `,
          [row.id, status, resultSummary]
        );

        if (!updated.rows[0]) return;

        const validation = fromValidationRow({ ...updated.rows[0], script_name: row.script_name });
        refreshed.push(validation);
        summary.updatedCount += 1;
        if (status === "observed_resolved") summary.resolvedCount += 1;
        if (status === "observed_persistent") summary.persistentCount += 1;
        if (status === "insufficient_data") summary.insufficientDataCount += 1;

        if (row.suggestion_id) {
          await markSuggestionValidated({
            id: row.suggestion_id,
            status,
            resultSummary,
            validationId: row.id,
            db
          });
        }

        if (row.asset_id) {
          await addAssetHistory({
            assetId: row.asset_id,
            eventType: "script_observation_finished",
            message: resultSummary,
            oldValue: row.script_name || row.script_id,
            newValue: status,
            userId: row.started_by || null,
            userName: "Sistema",
            db
          });
        }

        await addLog({
          type: "script_observation_finished",
          message: resultSummary,
          userId: row.started_by || null,
          meta: {
            validationId: row.id,
            suggestionId: row.suggestion_id,
            alertId: row.alert_id,
            assetId: row.asset_id,
            status
          },
          db
        });
      });
    } catch (error) {
      summary.failedValidationCount += 1;
      summary.failedValidations.push({
        validationId: row.id,
        suggestionId: row.suggestion_id,
        alertId: row.alert_id,
        message: error.message
      });
    }
  }

  return options.summary ? summary : refreshed;
}
export async function cancelScriptValidation(id, user = null) {
  return await withTransaction(async (db) => {
  const result = await db(
    `
      UPDATE script_validation_runs
      SET status = 'validation_cancelled',
          finished_at = NOW(),
          active_key = NULL,
          result_summary = 'Observação cancelada manualmente.',
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('waiting_agent', 'prepared', 'observation_pending', 'pending_validation')
      RETURNING *
    `,
    [id]
  );

  if (!result.rows[0]) {
    const error = new Error("Observação não encontrada ou já finalizada.");
    error.statusCode = 404;
    throw error;
  }

  const validation = fromValidationRow(result.rows[0]);

  if (validation.suggestionId) {
    await markSuggestionValidated({
      id: validation.suggestionId,
      status: "validation_cancelled",
      resultSummary: "Observação cancelada manualmente.",
      validationId: validation.id,
      db
    });
  }

  if (validation.assetId) {
    await addAssetHistory({
      assetId: validation.assetId,
      eventType: "script_validation_cancelled",
      message: `${user?.name || "Usuário"} cancelou a validação de script vinculada à sugestão ${validation.suggestionId}.`,
      oldValue: validation.status,
      newValue: "validation_cancelled",
      userId: user?.id || null,
      userName: user?.name || null,
      db
    });
  }

  return validation;
  });
}

export async function listPendingScriptLogs() {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      WHERE logs.attention_required = TRUE
        AND logs.acknowledged_at IS NULL
      ORDER BY logs.created_at DESC
    `
  );

  return result.rows.map((row) => ({
    ...fromLogRow(row),
    scriptName: row.script_name || ""
  }));
}

export async function findScriptLogById(id) {
  const result = await query(
    `
      SELECT logs.*,
             scripts.name AS script_name
      FROM script_execution_logs logs
      LEFT JOIN maintenance_scripts scripts ON scripts.id = logs.script_id
      WHERE logs.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? {
    ...fromLogRow(result.rows[0]),
    scriptName: result.rows[0].script_name || ""
  } : null;
}

export async function acknowledgeScriptLog(id, user = null) {
  const result = await query(
    `
      UPDATE script_execution_logs
      SET attention_required = FALSE,
          acknowledged_at = NOW(),
          acknowledged_by = $2
      WHERE id = $1
      RETURNING *
    `,
    [id, user?.id || null]
  );

  if (!result.rows[0]) {
    const error = new Error("Log de script não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return fromLogRow(result.rows[0]);
}

export async function applyScriptLogSuggestedSolution(id, payload = {}, user = null) {
  const log = await findScriptLogById(id);
  if (!log) {
    const error = new Error("Log de script não encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const notes = trimString(
    payload.notes ||
      "Ação corretiva sugerida registrada para acompanhamento. Nenhum comando foi executado automaticamente.",
    maxLengths.notes
  );
  return await withTransaction(async (db) => {
  const result = await db(
    `
      UPDATE script_execution_logs
      SET corrective_action_status = 'suggested_solution_registered',
          corrective_action_notes = $2,
          attention_required = FALSE,
          acknowledged_at = COALESCE(acknowledged_at, NOW()),
          acknowledged_by = COALESCE(acknowledged_by, $3)
      WHERE id = $1
      RETURNING *
    `,
    [id, notes, user?.id || null]
  );

  if (log.assetId) {
    await addAssetHistory({
      assetId: log.assetId,
      eventType: "script_log_solution_registered",
      message:
        `${user?.name || "Usuário"} registrou solução sugerida para o log do script '${log.scriptName || log.scriptId}'. ` +
        "Nenhum comando foi executado automaticamente.",
      oldValue: log.errorType || null,
      newValue: notes,
      userId: user?.id || null,
      userName: user?.name || null,
      db
    });
  }

  await addLog({
    type: "script_log_solution_registered",
    message: "Solução sugerida registrada para log de script. Nenhum comando foi executado.",
    userId: user?.id || null,
    meta: { logId: id, suggestionId: log.suggestionId, assetId: log.assetId },
    db
  });

  return fromLogRow(result.rows[0]);
  });
}
