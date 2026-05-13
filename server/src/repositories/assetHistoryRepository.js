import { randomUUID } from "node:crypto";
import { query } from "../database.js";

export async function addAssetHistory({
  assetId,
  eventType,
  message,
  oldValue = null,
  newValue = null,
  userId = null,
  userName = null
}) {
  const result = await query(
    `
      INSERT INTO asset_history (id, asset_id, event_type, message, old_value, new_value, user_id, user_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, asset_id, event_type, message, old_value, new_value, user_name, created_at
    `,
    [randomUUID(), assetId, eventType, message, oldValue, newValue, userId, userName]
  );

  return fromRow(result.rows[0]);
}

export async function listAssetHistory(assetId) {
  const result = await query(
    `
      SELECT id, asset_id, event_type, message, old_value, new_value, user_name, created_at
      FROM asset_history
      WHERE asset_id = $1
      ORDER BY created_at DESC
    `,
    [assetId]
  );

  return result.rows.map(fromRow);
}

function fromRow(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    eventType: row.event_type,
    message: row.message,
    oldValue: row.old_value,
    newValue: row.new_value,
    userName: row.user_name,
    createdAt: row.created_at
  };
}
