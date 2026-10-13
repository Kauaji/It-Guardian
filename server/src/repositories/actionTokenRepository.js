import { randomUUID } from "node:crypto";
import { query } from "../database.js";

/** @import { QueryResult } from "pg" */

// Somente consultas sequenciais simples: na Vercel o pool tem UMA conexao, entao nada aqui segura conexao
// (transacao/lock) enquanto faz outra consulta. A atomicidade do "usar uma vez" vem de um UPDATE condicional.

/**
 * Cria o token e invalida os anteriores ainda nao usados da mesma pessoa e finalidade.
 * @param {{ userId: string, purpose: string, tokenHash: string, ttlMinutes: number, requestedIp?: string | null, createdBy?: string | null }} input
 * @returns {Promise<void>}
 */
export async function issueActionToken({ userId, purpose, tokenHash, ttlMinutes, requestedIp = null, createdBy = null }) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await query(
    `INSERT INTO auth_action_tokens (id, user_id, purpose, token_hash, expires_at, requested_ip, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, userId, purpose, tokenHash, expiresAt, requestedIp, createdBy]
  );
  await query("UPDATE auth_action_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND id <> $3", [
    userId,
    purpose,
    id
  ]);
}

/**
 * Quantos tokens a pessoa pediu na janela (usados ou nao): base do limite por conta.
 * @param {string} userId
 * @param {string} purpose
 * @param {number} windowMinutes
 * @returns {Promise<number>}
 */
export async function countRecentActionTokens(userId, purpose, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  /** @type {QueryResult<{ total: string | number }>} */
  const result = await query("SELECT COUNT(*) AS total FROM auth_action_tokens WHERE user_id = $1 AND purpose = $2 AND created_at >= $3", [
    userId,
    purpose,
    since
  ]);
  return Number(result.rows[0]?.total || 0);
}

/**
 * Le o token SEM consumi-lo (para validar a nova senha antes de gastar o link).
 * @param {string} tokenHash
 * @param {string} purpose
 * @returns {Promise<{ userId: string } | null>}
 */
export async function peekActionToken(tokenHash, purpose) {
  /** @type {QueryResult<{ user_id: string }>} */
  const result = await query(
    "SELECT user_id FROM auth_action_tokens WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()",
    [tokenHash, purpose]
  );
  return result.rows[0] ? { userId: result.rows[0].user_id } : null;
}

/**
 * Consome o token de forma atomica: so UM chamador recebe o `userId`, mesmo com pedidos simultaneos.
 * @param {string} tokenHash
 * @param {string} purpose
 * @returns {Promise<{ userId: string } | null>}
 */
export async function claimActionToken(tokenHash, purpose) {
  /** @type {QueryResult<{ user_id: string }>} */
  const result = await query(
    `UPDATE auth_action_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash, purpose]
  );
  return result.rows[0] ? { userId: result.rows[0].user_id } : null;
}

/**
 * @param {string} userId
 * @param {string} purpose
 * @returns {Promise<void>}
 */
export async function invalidateUserActionTokens(userId, purpose) {
  await query("UPDATE auth_action_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
}
