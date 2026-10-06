// Regras puras do cadastro de scripts de manutenção (rótulos, conversões e inferências).

export const emptyForm = {
  name: "",
  description: "",
  type: "powershell",
  content: "",
  category: "",
  riskLevel: "medium",
  requiresConfirmation: true,
  alertType: "",
  problemType: "",
  tags: "",
  relatedAlertTypes: "",
  relatedProblemTypes: "",
  recommendedForCategories: "",
  requiresLoggedUser: false,
  requiresAdmin: false
};

export const scriptTypeLabels = {
  cmd: "CMD",
  powershell: "PowerShell"
};

export const riskLabels = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico"
};

export function formatRisk(risk) {
  return riskLabels[risk] || risk || "Médio";
}

export function toCommaList(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

export function fromCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildScriptPayload(form, analysis) {
  return {
    name: form.name,
    description: form.description,
    type: form.type,
    content: form.content,
    category: form.category,
    riskLevel: form.riskLevel,
    requiresConfirmation: form.requiresConfirmation,
    alertType: form.alertType,
    problemType: form.problemType,
    tags: fromCommaList(form.tags),
    relatedAlertTypes: fromCommaList(form.relatedAlertTypes),
    relatedProblemTypes: fromCommaList(form.relatedProblemTypes),
    recommendedForCategories: fromCommaList(form.recommendedForCategories),
    requiresLoggedUser: form.requiresLoggedUser,
    requiresAdmin: form.requiresAdmin,
    supportedVariables: analysis?.detectedVariables || [],
    safePreview: analysis?.safePreview,
    variableValidationStatus: analysis?.variableValidationStatus,
    estimatedSummary: analysis?.estimatedSummary,
    suggestedRiskLevel: analysis?.suggestedRiskLevel
  };
}

export function inferScriptType(content = "") {
  const text = String(content).toLowerCase();
  if (/\b(get|set|new|remove|start|stop|write|test)-[a-z]/i.test(content) || text.includes("$env:") || text.includes("powershell")) {
    return "powershell";
  }

  return "cmd";
}

export function inferScriptName(analysis, content = "") {
  const firstAction = analysis?.detectedActions?.[0];
  if (firstAction) return firstAction;

  const firstLine = String(content)
    .split(/\r?\n/)
    .map((line) => line.replace(/^rem\s+/i, "").replace(/^::\s*/, "").trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 80) : "Script de manutenção";
}

export function inferScriptCategory(analysis, content = "") {
  const text = `${content} ${(analysis?.detectedActions || []).join(" ")}`.toLowerCase();
  if (text.includes("disco") || text.includes("disk") || text.includes("chkdsk")) return "Disco";
  if (text.includes("rede") || text.includes("ping") || text.includes("ipconfig") || text.includes("netsh")) return "Rede";
  if (text.includes("impress") || text.includes("printer")) return "Impressora";
  if (text.includes("mem") || text.includes("ram")) return "Memória";
  return "Manutenção";
}

/** Formulário preenchido a partir de um script já cadastrado (edição). */
export function scriptToForm(script) {
  return {
    name: script.name || "",
    description: script.description || "",
    type: script.type || "other",
    content: script.content || "",
    category: script.category || "",
    riskLevel: script.riskLevel || "medium",
    requiresConfirmation: script.requiresConfirmation !== false,
    alertType: script.alertType || "",
    problemType: script.problemType || "",
    tags: toCommaList(script.tags),
    relatedAlertTypes: toCommaList(script.relatedAlertTypes),
    relatedProblemTypes: toCommaList(script.relatedProblemTypes),
    recommendedForCategories: toCommaList(script.recommendedForCategories),
    requiresLoggedUser: script.requiresLoggedUser === true,
    requiresAdmin: script.requiresAdmin === true
  };
}

/** Análise mínima exibida ao editar: só o resumo salvo, com aviso de revisão manual. */
export function savedScriptAnalysis(script) {
  return {
    estimatedSummary: script.estimatedSummary,
    suggestedRiskLevel: script.suggestedRiskLevel,
    detectedActions: [],
    safetyWarnings: ["Resumo salvo anteriormente. Revise manualmente antes de usar."]
  };
}

/** Preenche só os campos vazios do formulário com o que a análise inferiu. */
export function applyAnalysisToForm(current, result) {
  const inferredCategory = inferScriptCategory(result, current.content);
  return {
    ...current,
    name: current.name.trim() || inferScriptName(result, current.content),
    description: current.description.trim() || result?.estimatedSummary || "",
    type: inferScriptType(current.content),
    category: current.category.trim() || inferredCategory,
    riskLevel: result?.suggestedRiskLevel || current.riskLevel,
    alertType: current.alertType.trim() || inferredCategory.toLowerCase(),
    problemType: current.problemType.trim() || inferScriptName(result, current.content)
  };
}
