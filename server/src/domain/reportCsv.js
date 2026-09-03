const CSV_DELIMITER = ";";
const CSV_BOM = "﻿";
const FORMULA_INJECTION_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Allowlist por tipo de relatorio: uma coluna nova em qualquer tabela de
 * origem nasce excluida ate alguem decidir inclui-la aqui de proposito.
 * Alimenta tanto o CSV quanto a tabela de preview na tela, para os dois
 * nunca divergirem sobre o que e seguro mostrar/exportar.
 */
export const REPORT_COLUMNS = {
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
    { key: "reopenReason", header: "Motivo da reabertura" },
    { key: "feedbackRating", header: "Nota do feedback" },
    { key: "feedbackComment", header: "Comentario do feedback" }
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
    { key: "metric", header: "Metrica" },
    { key: "value", header: "Valor" },
    { key: "threshold", header: "Limite" },
    { key: "occurrencesCount", header: "Ocorrencias" },
    { key: "status", header: "Status" },
    { key: "firstSeenAt", header: "Primeira ocorrencia" },
    { key: "lastSeenAt", header: "Ultima ocorrencia" },
    { key: "suggestionStatus", header: "Status da sugestao de OS" },
    { key: "generatedServiceOrderNumber", header: "OS gerada" },
    { key: "hasExecutedScript", header: "Script executado" }
  ],
  scripts: [
    { key: "assetName", header: "Ativo" },
    { key: "scriptName", header: "Script" },
    { key: "riskLevel", header: "Risco" },
    { key: "status", header: "Status" },
    { key: "timeoutSeconds", header: "Timeout (s)" },
    { key: "requestedByName", header: "Solicitado por" },
    { key: "claimedAt", header: "Iniciado em" },
    { key: "completedAt", header: "Concluido em" },
    { key: "durationMinutes", header: "Duracao (min)" },
    { key: "exitCode", header: "Codigo de saida" },
    { key: "timedOut", header: "Atingiu timeout" },
    { key: "stdoutExcerpt", header: "Saida (trecho)" },
    { key: "stderrExcerpt", header: "Erro (trecho)" },
    { key: "errorMessage", header: "Mensagem de erro" },
    { key: "createdAt", header: "Criado em" }
  ],
  remote_assistance: [
    { key: "assetName", header: "Ativo" },
    { key: "technicianName", header: "Tecnico" },
    { key: "statusLabel", header: "Status" },
    { key: "connectionModeLabel", header: "Transporte" },
    { key: "consentStatus", header: "Consentimento" },
    { key: "requestedAt", header: "Solicitado em" },
    { key: "startedAt", header: "Iniciado em" },
    { key: "endedAt", header: "Encerrado em" },
    { key: "durationMinutes", header: "Duracao (min)" },
    { key: "endReason", header: "Motivo do encerramento" }
  ]
};

function needsFormulaNeutralization(value) {
  return FORMULA_INJECTION_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function toCellText(value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  // O driver do Postgres devolve TIMESTAMPTZ ja como objeto Date (o pg-mem
  // usado nos testes tambem, dependendo da coluna) - String(Date) produz um
  // formato local verboso ("Fri Aug 21 2026 09:20:30 GMT-0300 (...)"), bem
  // diferente do ISO que a mesma linha mostra no preview via JSON.stringify
  // (que chama Date.toJSON()). Forcar ISO aqui mantem os dois caminhos
  // consistentes.
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function escapeCsvValue(value) {
  let text = toCellText(value);
  if (needsFormulaNeutralization(text)) text = `'${text}`;

  const needsQuoting = text.includes(CSV_DELIMITER) || text.includes('"') || text.includes("\n") || text.includes("\r");
  if (!needsQuoting) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * CSV pt-BR: delimitador `;` (Excel separa em colunas sem assistente
 * manual), BOM UTF-8 (sem ele o Excel do Windows le como Windows-1252 e
 * estraga acentuacao), quebra de linha CRLF. `columns` deve vir de
 * REPORT_COLUMNS - nunca das chaves cruas do objeto, para o allowlist
 * valer de verdade.
 */
export function toCsv(columns, rows) {
  const headerLine = columns.map((column) => escapeCsvValue(column.header)).join(CSV_DELIMITER);
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(CSV_DELIMITER)
  );
  return CSV_BOM + [headerLine, ...lines].join("\r\n") + "\r\n";
}
