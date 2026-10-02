import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";

export async function getSecurityState(userId) {
  const result = await query(
    `
      SELECT token_version, failed_login_attempts, lockout_count, locked_until,
             must_change_password, mfa_enabled, mfa_secret_encrypted,
             mfa_pending_secret_encrypted, mfa_last_used_step, password_changed_at
      FROM users WHERE id = $1
    `,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenVersion: Number(row.token_version || 0),
    failedLoginAttempts: Number(row.failed_login_attempts || 0),
    lockoutCount: Number(row.lockout_count || 0),
    lockedUntil: row.locked_until,
    mustChangePassword: Boolean(row.must_change_password),
    mfaEnabled: Boolean(row.mfa_enabled),
    mfaSecretEncrypted: row.mfa_secret_encrypted,
    mfaPendingSecretEncrypted: row.mfa_pending_secret_encrypted,
    mfaLastUsedStep: row.mfa_last_used_step == null ? null : Number(row.mfa_last_used_step),
    passwordChangedAt: row.password_changed_at
  };
}

/**
 * Registra uma falha de login. Ao atingir `threshold` falhas seguidas bloqueia
 * a conta por um tempo progressivo (lockoutSeconds[n-esimo bloqueio]).
 * Devolve { lockedUntil } quando um bloqueio foi aplicado agora.
 */
export async function recordFailedLogin(userId, { threshold, lockoutSeconds }) {
  return withTransaction(async (db) => {
    const current = await db(
      "SELECT failed_login_attempts, lockout_count FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!current.rows[0]) return { lockedUntil: null, attempts: 0 };
    const attempts = Number(current.rows[0].failed_login_attempts || 0) + 1;
    if (attempts < threshold) {
      await db("UPDATE users SET failed_login_attempts = $2 WHERE id = $1", [userId, attempts]);
      return { lockedUntil: null, attempts };
    }
    const lockoutCount = Number(current.rows[0].lockout_count || 0);
    const seconds = lockoutSeconds[Math.min(lockoutCount, lockoutSeconds.length - 1)];
    const lockedUntil = new Date(Date.now() + seconds * 1000);
    await db(
      "UPDATE users SET failed_login_attempts = 0, lockout_count = $2, locked_until = $3 WHERE id = $1",
      [userId, lockoutCount + 1, lockedUntil]
    );
    return { lockedUntil, attempts };
  });
}

export async function recordSuccessfulLogin(userId) {
  await query(
    `
      UPDATE users
      SET failed_login_attempts = 0, lockout_count = 0, locked_until = NULL, last_login_at = NOW()
      WHERE id = $1
    `,
    [userId]
  );
}

export async function clearLockout(userId) {
  await query(
    "UPDATE users SET failed_login_attempts = 0, lockout_count = 0, locked_until = NULL WHERE id = $1",
    [userId]
  );
}

/** Troca a senha e invalida todos os tokens antigos (token_version + 1). */
export async function setUserPassword(userId, passwordHash, { mustChangePassword = false } = {}) {
  const result = await query(
    `
      UPDATE users
      SET password_hash = $2,
          password_changed_at = NOW(),
          must_change_password = $3,
          token_version = token_version + 1,
          failed_login_attempts = 0,
          lockout_count = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING token_version
    `,
    [userId, passwordHash, Boolean(mustChangePassword)]
  );
  return result.rows[0] ? Number(result.rows[0].token_version) : null;
}

export async function bumpTokenVersion(userId) {
  const result = await query(
    "UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version",
    [userId]
  );
  return result.rows[0] ? Number(result.rows[0].token_version) : null;
}

export async function saveMfaPendingSecret(userId, sealedSecret) {
  await query("UPDATE users SET mfa_pending_secret_encrypted = $2 WHERE id = $1", [userId, sealedSecret]);
}

export async function activateMfa(userId, { lastUsedStep }) {
  await query(
    `
      UPDATE users
      SET mfa_enabled = TRUE,
          mfa_secret_encrypted = mfa_pending_secret_encrypted,
          mfa_pending_secret_encrypted = NULL,
          mfa_confirmed_at = NOW(),
          mfa_last_used_step = $2
      WHERE id = $1 AND mfa_pending_secret_encrypted IS NOT NULL
    `,
    [userId, lastUsedStep]
  );
}

export async function deactivateMfa(userId) {
  await withTransaction(async (db) => {
    await db(
      `
        UPDATE users
        SET mfa_enabled = FALSE, mfa_secret_encrypted = NULL, mfa_pending_secret_encrypted = NULL,
            mfa_confirmed_at = NULL, mfa_last_used_step = NULL
        WHERE id = $1
      `,
      [userId]
    );
    await db("DELETE FROM user_recovery_codes WHERE user_id = $1", [userId]);
  });
}

/**
 * Marca o passo TOTP como usado de forma atomica: so avanca se for maior que o
 * ultimo registrado (duas requisicoes simultaneas com o mesmo codigo nao
 * passam as duas).
 */
export async function claimMfaStep(userId, step) {
  const result = await query(
    `
      UPDATE users SET mfa_last_used_step = $2
      WHERE id = $1 AND (mfa_last_used_step IS NULL OR mfa_last_used_step < $2)
      RETURNING id
    `,
    [userId, step]
  );
  return result.rowCount > 0;
}

export async function replaceRecoveryCodes(userId, codeHashes) {
  await withTransaction(async (db) => {
    await db("DELETE FROM user_recovery_codes WHERE user_id = $1", [userId]);
    for (const codeHash of codeHashes) {
      await db(
        "INSERT INTO user_recovery_codes (id, user_id, code_hash) VALUES ($1, $2, $3)",
        [randomUUID(), userId, codeHash]
      );
    }
  });
}

export async function consumeRecoveryCode(userId, codeHash) {
  const result = await query(
    `
      UPDATE user_recovery_codes SET used_at = NOW()
      WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
      RETURNING id
    `,
    [userId, codeHash]
  );
  return result.rowCount > 0;
}

export async function countUnusedRecoveryCodes(userId) {
  const result = await query(
    "SELECT COUNT(*)::int AS total FROM user_recovery_codes WHERE user_id = $1 AND used_at IS NULL",
    [userId]
  );
  return Number(result.rows[0]?.total || 0);
}
