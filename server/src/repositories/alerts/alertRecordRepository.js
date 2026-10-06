import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { defaultAlertSettings, normalizeAlertComment, toNumber } from "../../domain/alerts/alertConfiguration.js";
import { fromAlertCommentRow, fromAlertRow } from "./alertMappers.js";

export async function upsertAlert(alert) {
  const result = await query(
    `
      INSERT INTO alerts (
        id, asset_id, host_name, type, metric, title, description, severity,
        value, threshold, status, first_seen_at, last_seen_at, occurrences_count, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id)
      DO UPDATE SET
        asset_id = EXCLUDED.asset_id,
        host_name = EXCLUDED.host_name,
        type = EXCLUDED.type,
        metric = EXCLUDED.metric,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        severity = EXCLUDED.severity,
        value = EXCLUDED.value,
        threshold = EXCLUDED.threshold,
        status = EXCLUDED.status,
        first_seen_at = CASE
          WHEN alerts.status = 'resolved' AND EXCLUDED.status <> 'resolved'
            THEN EXCLUDED.first_seen_at
          ELSE alerts.first_seen_at
        END,
        last_seen_at = EXCLUDED.last_seen_at,
        occurrences_count = CASE
          WHEN alerts.status = 'resolved' AND EXCLUDED.status <> 'resolved'
            THEN alerts.occurrences_count + 1
          ELSE GREATEST(alerts.occurrences_count, EXCLUDED.occurrences_count)
        END,
        source = EXCLUDED.source,
        updated_at = NOW()
      RETURNING *
    `,
    [
      alert.id,
      alert.assetId || alert.hostId || null,
      alert.hostName || null,
      alert.type,
      alert.metric,
      alert.title,
      alert.description || "",
      alert.severity || "warning",
      alert.value ?? null,
      alert.threshold ?? null,
      alert.status || "active",
      alert.firstSeenAt || alert.startedAt || new Date().toISOString(),
      alert.lastSeenAt || alert.resolvedAt || alert.startedAt || new Date().toISOString(),
      alert.occurrencesCount || 1,
      alert.source || "system"
    ]
  );

  return fromAlertRow(result.rows[0]);
}

export async function listAlerts({ status } = {}) {
  const params = [];
  const where = ["source <> 'mock'"];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }

  const result = await query(
    `
      SELECT *
      FROM alerts
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY last_seen_at DESC, created_at DESC
    `,
    params
  );

  return result.rows.map(fromAlertRow);
}

export async function resolveInactiveAgentAlerts({
  assetId,
  activeAlertIds = [],
  inactiveHours = defaultAlertSettings.inactiveAlertAutoResolveHours
}) {
  const params = [assetId];
  const exclusions = activeAlertIds.map((id) => {
    params.push(id);
    return `$${params.length}`;
  });
  const normalizedInactiveHours = Math.max(
    1,
    toNumber(inactiveHours, defaultAlertSettings.inactiveAlertAutoResolveHours)
  );
  params.push(new Date(Date.now() - normalizedInactiveHours * 60 * 60 * 1000).toISOString());
  const inactiveBeforeParam = `$${params.length}`;
  const result = await query(
    `
      UPDATE alerts
      SET status = 'resolved',
          updated_at = NOW()
      WHERE source = 'agent'
        AND asset_id = $1
        AND status = 'active'
        ${exclusions.length ? `AND id NOT IN (${exclusions.join(", ")})` : ""}
        AND last_seen_at <= ${inactiveBeforeParam}
      RETURNING *
    `,
    params
  );

  const resolvedAlertIds = result.rows.map((row) => row.id);
  if (resolvedAlertIds.length) {
    await query(
      `
        UPDATE service_order_suggestions
        SET status = 'resolved',
            observation_status = COALESCE(observation_status, 'observed_resolved'),
            observation_result = COALESCE(observation_result, 'Aviso encerrado automaticamente por inatividade.'),
            last_observation_at = NOW(),
            updated_at = NOW()
        WHERE alert_id = ANY($1::text[])
          AND status = 'pending'
      `,
      [resolvedAlertIds]
    );
  }

  return result.rows.map(fromAlertRow);
}

export async function findAlertById(id) {
  const result = await query("SELECT * FROM alerts WHERE id = $1", [id]);
  return result.rows[0] ? fromAlertRow(result.rows[0]) : null;
}

export async function listAlertComments(alertId) {
  const result = await query(
    `
      SELECT comments.*,
             users.name AS user_name
      FROM alert_comments comments
      LEFT JOIN users ON users.id = comments.user_id
      WHERE comments.alert_id = $1
      ORDER BY comments.created_at ASC
    `,
    [alertId]
  );

  return result.rows.map(fromAlertCommentRow);
}

export async function insertAlertComment({ alertId, userId, message }) {
  const result = await query(
    `
      INSERT INTO alert_comments (id, alert_id, user_id, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [randomUUID(), alertId, userId || null, message]
  );

  return fromAlertCommentRow(result.rows[0]);
}

export async function resolveAlertIfActive(db, alertId) {
  await db(
    `
      UPDATE alerts
      SET status = 'resolved',
          updated_at = NOW()
      WHERE id = $1
        AND status = 'active'
    `,
    [alertId]
  );
}

export async function addAlertComment({ alertId, userId, message }) {
  return insertAlertComment({ alertId, userId, message: normalizeAlertComment(message) });
}
