import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { fromFeedbackRow } from "./serviceOrderMappers.js";

export async function findServiceOrderFeedback(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_feedback WHERE service_order_id = $1",
    [serviceOrderId]
  );
  return fromFeedbackRow(result.rows[0]);
}

export async function listServiceOrderFeedbackByOrderIds(orderIds = []) {
  const ids = orderIds.filter(Boolean);
  const feedbackByOrder = new Map();
  if (!ids.length) return feedbackByOrder;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `SELECT * FROM service_order_feedback WHERE service_order_id IN (${placeholders})`,
    ids
  );
  for (const row of result.rows.map(fromFeedbackRow)) {
    feedbackByOrder.set(row.serviceOrderId, row);
  }
  return feedbackByOrder;
}

/** Uma avaliacao por OS (indice unico): reenviar atualiza a existente. */
export async function upsertServiceOrderFeedback({ serviceOrderId, rating, comment, user, source }) {
  const result = await query(
    `
      INSERT INTO service_order_feedback (
        id, service_order_id, rating, comment, submitted_by_name, submitted_by, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (service_order_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        submitted_by_name = EXCLUDED.submitted_by_name,
        submitted_by = EXCLUDED.submitted_by,
        submitted_at = NOW(),
        source = EXCLUDED.source
      RETURNING *
    `,
    [randomUUID(), serviceOrderId, rating, comment || null, user?.name || null, user?.id || null, source]
  );
  return fromFeedbackRow(result.rows[0]);
}
