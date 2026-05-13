import { randomUUID } from "node:crypto";
import { query } from "../database.js";

export async function addLog({ type, message, userId, meta = {} }) {
  const result = await query(
    `
      INSERT INTO audit_logs (id, type, message, user_id, meta)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, type, message, user_id, meta, created_at
    `,
    [randomUUID(), type, message, userId || null, JSON.stringify(meta)]
  );

  return fromRow(result.rows[0]);
}

export async function listLogs() {
  const result = await query(
    `
      SELECT logs.id,
             logs.type,
             logs.message,
             logs.user_id,
             logs.meta,
             logs.created_at,
             users.name AS user_name,
             users.email AS user_email
      FROM audit_logs logs
      LEFT JOIN users ON users.id = logs.user_id
      ORDER BY logs.created_at DESC
      LIMIT 500
    `
  );

  return result.rows.map(fromRow);
}

function fromRow(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    userId: row.user_id,
    user: row.user_name
      ? {
          name: row.user_name,
          email: row.user_email
        }
      : null,
    meta: row.meta,
    createdAt: row.created_at
  };
}
