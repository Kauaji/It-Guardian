import { randomUUID } from "node:crypto";
import { query } from "../database.js";

/** @import { QueryFn } from "../database.js" */
/** @import { QueryResult } from "pg" */

/**
 * Linha de `audit_logs` (com `LEFT JOIN users` em `listLogs`).
 * @typedef {object} LogRow
 * @property {string} id
 * @property {string} type
 * @property {string} message
 * @property {string | null} user_id
 * @property {string | null} [user_name]
 * @property {string | null} [user_email]
 * @property {unknown} meta
 * @property {Date | string} created_at
 */

/**
 * @typedef {object} AuditLog
 * @property {string} id
 * @property {string} type
 * @property {string} message
 * @property {string | null} userId
 * @property {{ name: string, email: string | null | undefined } | null} user
 * @property {unknown} meta
 * @property {Date | string} createdAt
 */

/**
 * @param {{ type: string, message: string, userId?: string | null, meta?: Record<string, unknown>, db?: QueryFn }} entry `db` permite gravar dentro de uma transacao.
 * @returns {Promise<AuditLog>}
 */
export async function addLog({ type, message, userId, meta = {}, db = query }) {
  /** @type {QueryResult<LogRow>} */
  const result = await db(
    `
      INSERT INTO audit_logs (id, type, message, user_id, meta)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, type, message, user_id, meta, created_at
    `,
    [randomUUID(), type, message, userId || null, JSON.stringify(meta)]
  );

  return fromRow(result.rows[0]);
}

/**
 * @returns {Promise<AuditLog[]>} Ate 500 registros, do mais recente ao mais antigo.
 */
export async function listLogs() {
  /** @type {QueryResult<LogRow>} */
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

/**
 * @param {LogRow} row
 * @returns {AuditLog}
 */
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
