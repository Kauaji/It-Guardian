import { randomUUID } from "node:crypto";
import { query } from "../database.js";

export async function createSecurityReauthentication({
  userId,
  action,
  assetId = null,
  serviceOrderId = null,
  tokenHash,
  expiresAt,
  db = query
}) {
  const result = await db(
    `
      INSERT INTO security_reauthentications (
        id, user_id, action, asset_id, service_order_id, token_hash, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, action, asset_id, service_order_id, expires_at, created_at
    `,
    [randomUUID(), userId, action, assetId, serviceOrderId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

export async function addSecurityReauthenticationAttempt({
  userId,
  action,
  assetId = null,
  serviceOrderId = null,
  succeeded,
  requestIp = null,
  userAgent = null,
  db = query
}) {
  await db(
    `
      INSERT INTO security_reauthentication_attempts (
        id, user_id, action, asset_id, service_order_id, succeeded, request_ip, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      randomUUID(),
      userId,
      action,
      assetId,
      serviceOrderId,
      Boolean(succeeded),
      requestIp,
      String(userAgent || "").slice(0, 500) || null
    ]
  );
}

export async function consumeSecurityReauthentication({
  userId,
  action,
  assetId = null,
  serviceOrderId = null,
  tokenHash,
  db = query
}) {
  const result = await db(
    `
      UPDATE security_reauthentications
      SET used_at = NOW()
      WHERE user_id = $1
        AND action = $2
        AND COALESCE(asset_id, '') = COALESCE($3, '')
        AND COALESCE(service_order_id, '') = COALESCE($4, '')
        AND token_hash = $5
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING id, expires_at
    `,
    [userId, action, assetId, serviceOrderId, tokenHash]
  );
  return result.rows[0] || null;
}
