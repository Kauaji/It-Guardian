import { parseArrayValue } from "../../domain/maintenanceScripts/listNormalization.js";

/** Mapeamento das linhas do banco para os objetos de dominio de scripts, logs e validacoes. */

export function fromScriptRow(row) {
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
    contentUpdatedBy: row.content_updated_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromLogRow(row) {
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

export function fromValidationRow(row) {
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
