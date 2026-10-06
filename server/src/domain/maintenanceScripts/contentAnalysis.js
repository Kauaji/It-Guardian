import { allowedScriptVariables, maxLengths } from "./scriptVocabulary.js";

/**
 * Analise estimada do conteudo de um script: variaveis, acoes detectadas e
 * nivel de risco SUGERIDO. E consultiva: nunca bloqueia nem executa nada (o
 * bloqueio rigido fica em contentSafety.js).
 */

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

export function detectScriptVariables(content = "") {
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

/**
 * @param {string} current
 * @param {string} candidate
 */
function chooseHigherRisk(current, candidate) {
  const rank = /** @type {Record<string, number>} */ (riskRank);
  return rank[candidate] > rank[current] ? candidate : current;
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
      safetyWarnings: ["Nenhum comando foi executado.", "O conteúdo é tratado apenas como texto armazenado."]
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
