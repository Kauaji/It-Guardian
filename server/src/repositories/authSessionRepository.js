import { randomUUID } from "node:crypto";
import { query } from "../database.js";

/** @import { QueryResult } from "pg" */
/** @import { AuthSession, AuthSessionRow } from "../types/identity.js" */

/**
 * @param {AuthSessionRow} row
 * @returns {AuthSession}
 */
function fromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenVersion: Number(row.token_version || 0),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    ip: row.ip,
    userAgent: row.user_agent
  };
}

/**
 * @param {{ userId: string, tokenVersion: number, absoluteExpiresAt: Date, ip?: string | null, userAgent?: string | null }} input
 * @returns {Promise<AuthSession>}
 */
export async function createAuthSession({ userId, tokenVersion, absoluteExpiresAt, ip = null, userAgent = null }) {
  /** @type {QueryResult<AuthSessionRow>} */
  const result = await query(
    `
      INSERT INTO auth_sessions (id, user_id, token_version, absolute_expires_at, ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [randomUUID(), userId, tokenVersion, absoluteExpiresAt, ip, String(userAgent || "").slice(0, 300) || null]
  );
  return fromRow(result.rows[0]);
}

/**
 * @param {string} id
 * @returns {Promise<AuthSession | null>}
 */
export async function findAuthSession(id) {
  /** @type {QueryResult<AuthSessionRow>} */
  const result = await query("SELECT * FROM auth_sessions WHERE id = $1", [id]);
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function touchAuthSession(id) {
  await query("UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1", [id]);
}

/**
 * @param {string} userId
 * @returns {Promise<AuthSession[]>}
 */
export async function listActiveAuthSessions(userId) {
  /** @type {QueryResult<AuthSessionRow>} */
  const result = await query(
    `
      SELECT * FROM auth_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND absolute_expires_at > NOW()
      ORDER BY last_seen_at DESC
    `,
    [userId]
  );
  return result.rows.map(fromRow);
}

/**
 * @param {string} id
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<boolean>} `true` quando a sessao estava ativa e foi revogada.
 */
export async function revokeAuthSession(id, userId, reason) {
  const result = await query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(), revoked_reason = $3
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id
    `,
    [id, userId, reason]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * @param {string} userId
 * @param {string} reason
 * @param {{ exceptSessionId?: string | null }} [options]
 * @returns {Promise<number | null>} Quantidade revogada.
 */
export async function revokeAllAuthSessions(userId, reason, { exceptSessionId = null } = {}) {
  const result = await query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW(), revoked_reason = $2
      WHERE user_id = $1 AND revoked_at IS NULL AND ($3::text IS NULL OR id <> $3::text)
      RETURNING id
    `,
    [userId, reason, exceptSessionId]
  );
  return result.rowCount;
}

/**
 * @param {number} [olderThanDays]
 * @returns {Promise<number | null>} Quantidade apagada.
 */
export async function purgeExpiredAuthSessions(olderThanDays = 30) {
  const result = await query(
    `
      DELETE FROM auth_sessions
      WHERE absolute_expires_at < NOW() - ($1::int * INTERVAL '1 day')
         OR (revoked_at IS NOT NULL AND revoked_at < NOW() - ($1::int * INTERVAL '1 day'))
    `,
    [olderThanDays]
  );
  return result.rowCount;
}
