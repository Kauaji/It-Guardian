import { query } from "../../database.js";
import { fromScriptRow } from "./scriptMappers.js";

/**
 * SQL do catalogo de scripts de manutencao (maintenance_scripts). Recebe
 * scripts ja normalizados por domain/maintenanceScripts/scriptPayload.js; nao
 * valida nem decide nada.
 */

// Valores de coluna compartilhados entre INSERT/UPDATE (listas viram JSON).
function serializedListColumns(script) {
  return [
    JSON.stringify(script.tags),
    JSON.stringify(script.supportedVariables),
    JSON.stringify(script.relatedAlertTypes),
    JSON.stringify(script.relatedProblemTypes),
    JSON.stringify(script.recommendedForCategories)
  ];
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

export async function insertMaintenanceScript({ id, script, createdBy, contentUpdatedBy }) {
  const result = await query(
    `
      INSERT INTO maintenance_scripts (
        id, name, description, type, content, estimated_summary, category,
        risk_level, suggested_risk_level, requires_confirmation, active,
        alert_type, problem_type, tags, supported_variables, related_alert_types,
        related_problem_types, recommended_for_categories, requires_logged_user,
        requires_admin, safe_preview, variable_validation_status, created_by,
        content_updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING *
    `,
    [
      id,
      script.name,
      script.description,
      script.type,
      script.content,
      script.estimatedSummary,
      script.category,
      script.riskLevel,
      script.suggestedRiskLevel,
      script.requiresConfirmation,
      script.active,
      script.alertType || null,
      script.problemType || null,
      ...serializedListColumns(script),
      script.requiresLoggedUser,
      script.requiresAdmin,
      script.safePreview,
      script.variableValidationStatus,
      createdBy,
      contentUpdatedBy
    ]
  );

  return fromScriptRow(result.rows[0]);
}

export async function updateMaintenanceScriptById({ id, script, contentUpdatedBy }) {
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
          content_updated_by = $23,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      script.name,
      script.description,
      script.type,
      script.content,
      script.estimatedSummary,
      script.category,
      script.riskLevel,
      script.suggestedRiskLevel,
      script.requiresConfirmation,
      script.active,
      script.alertType || null,
      script.problemType || null,
      ...serializedListColumns(script),
      script.requiresLoggedUser,
      script.requiresAdmin,
      script.safePreview,
      script.variableValidationStatus,
      contentUpdatedBy
    ]
  );

  return result.rows[0] ? fromScriptRow(result.rows[0]) : null;
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

export async function maintenanceScriptExists(id) {
  const existing = await query("SELECT id FROM maintenance_scripts WHERE id = $1", [id]);
  return existing.rows.length > 0;
}

// Colunas gravadas pela semente dos scripts padrao (a mesma ordem no INSERT e no UPDATE).
function seedColumnValues(id, script) {
  return [
    id,
    script.name,
    script.description,
    script.type,
    script.content,
    script.estimatedSummary,
    script.category,
    script.riskLevel,
    script.suggestedRiskLevel,
    script.alertType || null,
    script.problemType || null,
    ...serializedListColumns(script),
    script.requiresLoggedUser,
    script.requiresAdmin,
    script.safePreview,
    script.variableValidationStatus
  ];
}

export async function updateDefaultMaintenanceScript(id, script) {
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
    seedColumnValues(id, script)
  );
}

export async function insertDefaultMaintenanceScript(id, script) {
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
    seedColumnValues(id, script)
  );
}
