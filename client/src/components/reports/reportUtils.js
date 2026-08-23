/**
 * Configuracao dos 7 tipos de relatorio: permissao exigida (mesmo mapa de
 * `reportTypePermissions` do server, `server/src/services/reportService.js`)
 * e quais filtros cada tipo realmente aceita no backend - a UI so mostra um
 * campo de filtro quando o relatorio de fato sabe usa-lo.
 */
export const REPORT_TYPES = [
  {
    id: "monthly",
    label: "Mensal",
    description: "Panorama consolidado do periodo: ativos, OS, SLA e alertas.",
    permissions: ["reports.view"],
    filters: ["startDate", "endDate"]
  },
  {
    id: "service_orders",
    label: "Ordens de Servico",
    description: "Lista detalhada de OS com status, prioridade, origem e SLA.",
    permissions: ["reports.view", "reports.view_service_orders"],
    filters: ["startDate", "endDate", "status", "priority", "origin", "environmentName", "technician", "search"]
  },
  {
    id: "sla",
    label: "SLA",
    description: "Cumprimento de prazo das Ordens de Servico.",
    permissions: ["reports.view", "reports.view_service_orders"],
    filters: ["startDate", "endDate", "priority"]
  },
  {
    id: "assets",
    label: "Ativos",
    description: "Inventario com status, segmento e metricas disponiveis.",
    permissions: ["reports.view", "reports.view_assets"],
    filters: ["status", "segmentName", "assetType", "search"]
  },
  {
    id: "alerts",
    label: "Avisos",
    description: "Avisos por severidade, categoria e vinculo com OS/scripts.",
    permissions: ["reports.view", "reports.view_alerts"],
    filters: ["startDate", "endDate", "severity", "category", "status", "segmentName"]
  },
  {
    id: "scripts",
    label: "Scripts",
    description: "Execucoes de scripts de manutencao, com saida resumida.",
    permissions: ["reports.view", "reports.view_scripts"],
    filters: ["startDate", "endDate", "status", "riskLevel"]
  },
  {
    id: "remote_assistance",
    label: "Assistencia Remota",
    description: "Sessoes de assistencia remota: duracao, transporte e motivo de encerramento.",
    permissions: ["reports.view", "reports.view_remote_assistance"],
    filters: ["startDate", "endDate", "status", "connectionMode"]
  }
];

export function getReportType(id) {
  return REPORT_TYPES.find((type) => type.id === id) || null;
}

export function canViewReportType(user, hasPermission, typeId) {
  const type = getReportType(typeId);
  if (!type) return false;
  return type.permissions.every((permission) => hasPermission(user, permission));
}

/**
 * Remove filtros vazios/"todos" antes de virar querystring - mantem a URL
 * limpa e evita mandar `status=all` para o backend.
 */
export function buildReportFilterParams(rawFilters = {}) {
  const params = {};
  for (const [key, value] of Object.entries(rawFilters)) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed === "" || trimmed == null || trimmed === "all") continue;
    params[key] = trimmed;
  }
  return params;
}

export const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Critica" }
];

export const originOptions = [
  { value: "manual", label: "Manual" },
  { value: "alert_suggestion", label: "Alerta" },
  { value: "public_support_form", label: "Portal publico" },
  { value: "preventive", label: "Preventiva" }
];

export const severityOptions = [
  { value: "critical", label: "Critica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baixa" },
  { value: "warning", label: "Atencao" }
];

export const riskLevelOptions = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Critico" }
];

export const scriptStatusOptions = [
  { value: "queued", label: "Na fila" },
  { value: "claimed", label: "Em execucao" },
  { value: "succeeded", label: "Concluido" },
  { value: "failed", label: "Falhou" },
  { value: "timed_out", label: "Tempo esgotado" }
];

export const remoteAssistanceStatusOptions = [
  { value: "requested", label: "Solicitada" },
  { value: "waiting_consent", label: "Aguardando consentimento" },
  { value: "active", label: "Ativa" },
  { value: "ended", label: "Encerrada" },
  { value: "failed", label: "Falhou" },
  { value: "expired", label: "Expirada" }
];

export const connectionModeOptions = [
  { value: "webrtc", label: "Video (WebRTC)" },
  { value: "snapshot_polling", label: "Capturas de tela" }
];

export const assetStatusOptions = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "problem", label: "Erro" },
  { value: "unknown", label: "Sem dados" }
];

/**
 * Subconjunto do allowlist do server (`server/src/domain/reportCsv.js`,
 * `REPORT_COLUMNS`) - a tabela na tela mostra so as colunas mais relevantes
 * para leitura rapida, o CSV exportado traz o allowlist completo. Toda
 * chave aqui existe no allowlist do server, entao a tela nunca mostra nada
 * que o CSV ja nao considerasse seguro exportar.
 */
export const REPORT_TABLE_COLUMNS = {
  monthly: [
    { key: "metric", header: "Metrica" },
    { key: "value", header: "Valor" }
  ],
  service_orders: [
    { key: "number", header: "Numero" },
    { key: "title", header: "Titulo" },
    { key: "statusLabel", header: "Status" },
    { key: "priorityLabel", header: "Prioridade" },
    { key: "originLabel", header: "Origem" },
    { key: "environmentName", header: "Ambiente" },
    { key: "sectorName", header: "Setor" },
    { key: "assetName", header: "Ativo" },
    { key: "assignedTechnicianName", header: "Tecnico" },
    { key: "createdAt", header: "Criada em" },
    { key: "firstResponseAt", header: "Primeira resposta" },
    { key: "slaDueAt", header: "Prazo SLA" },
    { key: "closedAt", header: "Fechada em" },
    { key: "reopenCount", header: "Reaberturas" },
    { key: "feedbackRating", header: "Nota do feedback" }
  ],
  sla: [
    { key: "number", header: "Numero" },
    { key: "title", header: "Titulo" },
    { key: "priorityLabel", header: "Prioridade" },
    { key: "slaStatusLabel", header: "Status do SLA" },
    { key: "dueAt", header: "Prazo" },
    { key: "remainingMinutes", header: "Minutos restantes" },
    { key: "createdAt", header: "Criada em" },
    { key: "closedAt", header: "Fechada em" }
  ],
  assets: [
    { key: "name", header: "Nome" },
    { key: "assetType", header: "Tipo" },
    { key: "statusLabel", header: "Status" },
    { key: "segmentName", header: "Segmento" },
    { key: "ip", header: "IP" },
    { key: "source", header: "Origem dos dados" },
    { key: "lastSeenAt", header: "Ultimo contato" },
    { key: "cpuPercent", header: "CPU (%)" },
    { key: "ramPercent", header: "RAM (%)" },
    { key: "diskPercent", header: "Disco (%)" }
  ],
  alerts: [
    { key: "assetName", header: "Ativo" },
    { key: "typeLabel", header: "Tipo" },
    { key: "category", header: "Categoria" },
    { key: "severityLabel", header: "Severidade" },
    { key: "occurrencesCount", header: "Ocorrencias" },
    { key: "status", header: "Status" },
    { key: "firstSeenAt", header: "Primeira ocorrencia" },
    { key: "lastSeenAt", header: "Ultima ocorrencia" },
    { key: "suggestionStatus", header: "Status da sugestao de OS" },
    { key: "generatedServiceOrderNumber", header: "OS gerada" }
  ],
  scripts: [
    { key: "assetName", header: "Ativo" },
    { key: "scriptName", header: "Script" },
    { key: "riskLevel", header: "Risco" },
    { key: "status", header: "Status" },
    { key: "requestedByName", header: "Solicitado por" },
    { key: "durationMinutes", header: "Duracao (min)" },
    { key: "exitCode", header: "Codigo de saida" },
    { key: "timedOut", header: "Atingiu timeout" },
    { key: "createdAt", header: "Criado em" }
  ],
  remote_assistance: [
    { key: "assetName", header: "Ativo" },
    { key: "technicianName", header: "Tecnico" },
    { key: "statusLabel", header: "Status" },
    { key: "connectionModeLabel", header: "Transporte" },
    { key: "requestedAt", header: "Solicitado em" },
    { key: "durationMinutes", header: "Duracao (min)" },
    { key: "endReason", header: "Motivo do encerramento" }
  ]
};
