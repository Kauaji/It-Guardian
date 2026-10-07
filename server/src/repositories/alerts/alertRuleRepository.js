import { query } from "../../database.js";
import { buildAlertRuleUpdate, defaultAlertRules, normalizePriority } from "../../domain/alerts/alertConfiguration.js";
import { fromRuleRow } from "./alertMappers.js";

export async function ensureDefaultAlertRules() {
  for (const rule of defaultAlertRules) {
    await query(
      `
        INSERT INTO alert_rules (
          id, type, metric, threshold, duration_minutes, recurrence_count,
          recurrence_window, suggested_priority, creates_suggestion, enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE
        SET suggested_priority = COALESCE(alert_rules.suggested_priority, EXCLUDED.suggested_priority)
      `,
      [
        rule.id,
        rule.type,
        rule.metric,
        rule.threshold,
        rule.durationMinutes,
        rule.recurrenceCount,
        rule.recurrenceWindow,
        normalizePriority(rule.suggestedPriority),
        rule.createsSuggestion,
        rule.enabled
      ]
    );
  }
}

export async function listAlertRules() {
  await ensureDefaultAlertRules();
  const result = await query(`
    SELECT *
    FROM alert_rules
    ORDER BY type ASC
  `);
  return result.rows.map(fromRuleRow);
}

export async function findAlertRuleRow(id) {
  const result = await query("SELECT * FROM alert_rules WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function updateAlertRuleRow(id, values) {
  const result = await query(
    `
      UPDATE alert_rules
      SET threshold = $2,
          duration_minutes = $3,
          recurrence_count = $4,
          recurrence_window = $5,
          suggested_priority = $6,
          creates_suggestion = $7,
          enabled = $8,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      values.threshold,
      values.durationMinutes,
      values.recurrenceCount,
      values.recurrenceWindow,
      values.suggestedPriority,
      values.createsSuggestion,
      values.enabled
    ]
  );

  return fromRuleRow(result.rows[0]);
}

export async function updateAlertRule(id, payload = {}) {
  await ensureDefaultAlertRules();
  const current = await findAlertRuleRow(id);

  if (!current) {
    const error = new Error("Regra de aviso não encontrada.");
    error.statusCode = 404;
    throw error;
  }

  return updateAlertRuleRow(id, buildAlertRuleUpdate(current, payload));
}
