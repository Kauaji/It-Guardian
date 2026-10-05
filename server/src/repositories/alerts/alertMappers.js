import { normalizePriority, toNumber } from "../../domain/alerts/alertConfiguration.js";

export function fromRuleRow(row) {
  return {
    id: row.id,
    type: row.type,
    metric: row.metric,
    threshold: toNumber(row.threshold),
    durationMinutes: toNumber(row.duration_minutes, 0),
    recurrenceCount: toNumber(row.recurrence_count, 1),
    recurrenceWindow: row.recurrence_window,
    suggestedPriority: normalizePriority(row.suggested_priority),
    createsSuggestion: row.creates_suggestion,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromAlertRow(row) {
  return {
    id: row.id,
    hostId: row.asset_id,
    assetId: row.asset_id,
    hostName: row.host_name,
    type: row.type,
    metric: row.metric,
    title: row.title,
    description: row.description,
    severity: row.severity,
    value: toNumber(row.value),
    threshold: toNumber(row.threshold),
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    startedAt: row.first_seen_at,
    resolvedAt: row.status === "resolved" ? row.last_seen_at : null,
    occurrencesCount: toNumber(row.occurrences_count, 1),
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromSuggestionRow(row) {
  return {
    id: row.id,
    alertId: row.alert_id,
    assetId: row.asset_id,
    title: row.title,
    description: row.description,
    suggestedPriority: row.suggested_priority,
    suggestedServiceId: row.suggested_service_id,
    suggestedProblemTypeId: row.suggested_problem_type_id,
    occurrencesCount: toNumber(row.occurrences_count, 1),
    status: row.status,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    ignoredUntil: row.ignored_until,
    rejectionSilenceUntil: row.rejection_silence_until,
    lastRejectedAt: row.last_rejected_at,
    observationStatus: row.observation_status || "none",
    observationResult: row.observation_result || "",
    lastValidationId: row.last_validation_id || null,
    lastObservationAt: row.last_observation_at || null,
    createdServiceOrderId: row.created_service_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromLatestSuggestionValidationRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    scriptId: row.script_id,
    scriptName: row.script_name,
    startedAt: row.started_at,
    validationWindowMinutes: toNumber(row.validation_window_minutes, 30),
    validationDueAt: row.validation_due_at,
    finishedAt: row.finished_at,
    resultSummary: row.result_summary || "",
    logId: row.log_id,
    log: row.log_id ? {
      id: row.log_id,
      status: row.log_status,
      rawLog: row.log_raw_log || "",
      errorDetected: row.log_error_detected === true,
      errorType: row.log_error_type,
      errorCode: row.log_error_code,
      errorCategory: row.log_error_category,
      errorSeverity: row.log_error_severity,
      parsedSummary: row.log_parsed_summary,
      probableCause: row.log_probable_cause,
      suggestedSolution: row.log_suggested_solution,
      requiresAdmin: row.log_requires_admin === true,
      requiresLoggedUser: row.log_requires_logged_user === true,
      attentionRequired: row.log_attention_required === true,
      acknowledgedAt: row.log_acknowledged_at
    } : null,
    job: row.job_id ? {
      id: row.job_id,
      status: row.job_status,
      claimedAt: row.job_claimed_at,
      completedAt: row.job_completed_at,
      exitCode: row.job_exit_code,
      timedOut: row.job_timed_out === true,
      stdout: row.job_stdout || "",
      stderr: row.job_stderr || "",
      errorMessage: row.job_error_message || ""
    } : null
  };
}

export function fromAlertCommentRow(row) {
  return {
    id: row.id,
    alertId: row.alert_id,
    userId: row.user_id,
    userName: row.user_name || "Usuário",
    message: row.message,
    createdAt: row.created_at
  };
}
