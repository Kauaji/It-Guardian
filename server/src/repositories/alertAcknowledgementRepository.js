import { query } from "../database.js";

export async function listAcknowledgements() {
  const result = await query(`
    SELECT acknowledgements.alert_id,
           acknowledgements.note,
           acknowledgements.acknowledged_at,
           users.id AS user_id,
           users.name AS user_name,
           users.email AS user_email
    FROM alert_acknowledgements acknowledgements
    LEFT JOIN users ON users.id = acknowledgements.acknowledged_by
    ORDER BY acknowledgements.acknowledged_at DESC
  `);

  return result.rows.map(fromRow);
}

export async function findAcknowledgement(alertId) {
  const result = await query(
    `
      SELECT acknowledgements.alert_id,
             acknowledgements.note,
             acknowledgements.acknowledged_at,
             users.id AS user_id,
             users.name AS user_name,
             users.email AS user_email
      FROM alert_acknowledgements acknowledgements
      LEFT JOIN users ON users.id = acknowledgements.acknowledged_by
      WHERE acknowledgements.alert_id = $1
    `,
    [alertId]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function upsertAcknowledgement({ alertId, userId, note }) {
  const result = await query(
    `
      INSERT INTO alert_acknowledgements (alert_id, acknowledged_by, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (alert_id)
      DO UPDATE SET acknowledged_by = EXCLUDED.acknowledged_by,
                    note = EXCLUDED.note,
                    acknowledged_at = NOW()
      RETURNING alert_id
    `,
    [alertId, userId, note || null]
  );

  return findAcknowledgement(result.rows[0].alert_id);
}

export async function deleteAcknowledgement(alertId) {
  const result = await query(
    "DELETE FROM alert_acknowledgements WHERE alert_id = $1 RETURNING alert_id",
    [alertId]
  );

  return result.rowCount > 0;
}

export function attachAcknowledgements(alerts, acknowledgements) {
  const byAlertId = new Map(acknowledgements.map((ack) => [ack.alertId, ack]));
  return alerts.map((alert) => ({
    ...alert,
    acknowledgement: byAlertId.get(alert.id) || null
  }));
}

function fromRow(row) {
  return {
    alertId: row.alert_id,
    note: row.note,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.user_id
      ? {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email
        }
      : null
  };
}
