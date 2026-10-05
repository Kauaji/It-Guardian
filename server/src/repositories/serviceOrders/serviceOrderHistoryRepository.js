import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { addAssetHistory } from "../assetHistoryRepository.js";
import { fromHistoryRow } from "./serviceOrderMappers.js";

export async function listServiceOrderHistory(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM service_order_history
      WHERE service_order_id = $1
      ORDER BY created_at DESC
    `,
    [serviceOrderId]
  );

  return result.rows.map(fromHistoryRow);
}

export async function addServiceOrderHistory({ serviceOrderId, eventType, message, oldValue, newValue, user, db = query }) {
  const result = await db(
    `
      INSERT INTO service_order_history (
        id, service_order_id, event_type, message, old_value, new_value, user_id, user_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      randomUUID(),
      serviceOrderId,
      eventType,
      message,
      oldValue ?? null,
      newValue ?? null,
      user?.id || null,
      user?.name || null
    ]
  );

  return fromHistoryRow(result.rows[0]);
}

export async function addServiceOrderAssetHistory({
  assetId,
  serviceOrder,
  eventType,
  message,
  oldValue,
  newValue,
  user,
  db = query
}) {
  if (!assetId) return null;
  return addAssetHistory({
    assetId,
    eventType: `service_order_${eventType}`,
    message: `OS ${serviceOrder.number}: ${message}`,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
    userId: user?.id || null,
    userName: user?.name || null,
    db
  });
}
