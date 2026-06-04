import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { addLog } from "./logRepository.js";
import { addServiceOrderHistory } from "./serviceOrderRepository.js";

export const scriptTypes = new Set(["bat", "cmd", "powershell", "shell", "other"]);
export const riskLevels = new Set(["low", "medium", "high", "critical"]);
export const simulationModes = new Set(["simulated", "prepared"]);

const maxLengths = {
  name: 120,
  description: 500,
  content: 10000,
  category: 80,
  alertType: 80,
  problemType: 120,
  notes: 1000
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
    problemType: "Internet lenta"
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
    problemType: "Sistema travando"
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
    problemType: "Disco acima do limite"
  }
];

function trimString(value, maxLength, fallback = "") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
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
    mode: row.mode,
    status: row.status,
    executedBy: row.executed_by,
    executedAt: row.executed_at,
    notes: row.notes || "",
    createdAt: row.created_at
  };
}

export function analyzeMaintenanceScriptContent(content = "") {
  const text = String(content ?? "").slice(0, maxLengths.content);
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
  const suggestedRiskLevel = normalizeRiskLevel(
    payload.suggestedRiskLevel ?? current.suggestedRiskLevel,
    analysis.suggestedRiskLevel
  );

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
    problemType: trimString(payload.problemType ?? current.problemType, maxLengths.problemType)
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
          normalized.problemType || null
        ]
      );
      continue;
    }

    await query(
      `
        INSERT INTO maintenance_scripts (
          id, name, description, type, content, estimated_summary, category,
          risk_level, suggested_risk_level, requires_confirmation, active,
          alert_type, problem_type, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, $10, $11, NULL)
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
        normalized.problemType || null
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
        alert_type, problem_type, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      normalized.problemType || null
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
  mode = "simulated",
  status = "registered",
  executedBy = null,
  notes = ""
}) {
  const safeMode = simulationModes.has(mode) ? mode : "simulated";
  const result = await query(
    `
      INSERT INTO script_execution_logs (
        id, script_id, asset_id, service_order_id, alert_id, mode, status, executed_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      randomUUID(),
      scriptId,
      assetId || null,
      serviceOrderId || null,
      alertId || null,
      safeMode,
      status,
      executedBy || null,
      trimString(notes, maxLengths.notes)
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

  const log = await createScriptSimulationLog({
    scriptId: script.id,
    assetId,
    serviceOrderId,
    alertId,
    mode,
    status: "registered",
    executedBy: user?.id || null,
    notes
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
      userName
    });
  }

  if (serviceOrderId) {
    await addServiceOrderHistory({
      serviceOrderId,
      eventType: "script_simulation",
      message: `Simulação de script registrada: ${script.name}. Nenhum comando foi executado.`,
      oldValue: null,
      newValue: historySummary,
      user
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
    }
  });

  return { log, script };
}
