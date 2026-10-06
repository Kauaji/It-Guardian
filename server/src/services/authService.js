import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { getAuthConfig, isProductionLike, resolveDatabaseConfig } from "../config/environment.js";
import { assertValidPassword } from "../domain/passwordPolicy.js";
import { normalizeRecoveryCode, verifyTotp } from "../domain/totp.js";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "../lib/errors.js";
import { authEvents } from "../lib/metrics.js";
import { query, withTransaction } from "../database.js";
import { addLog } from "../repositories/logRepository.js";
import {
  findUserByEmail,
  findUserById,
  toPublicUser
} from "../repositories/userRepository.js";
import {
  claimMfaStep,
  consumeRecoveryCode,
  getSecurityState,
  recordFailedLogin,
  recordSuccessfulLogin,
  setUserPassword
} from "../repositories/userSecurityRepository.js";
import { hashPassword, burnPasswordComparison, passwordNeedsRehash, verifyPassword } from "../security/passwordHasher.js";
import { openSecret } from "../security/secretBox.js";
import {
  issueMfaChallengeToken,
  revokeAllSessions,
  startSession,
  verifyMfaChallengeToken
} from "./sessionService.js";

/** @import { QueryResult } from "pg" */
/** @import { AuthSession, PublicUser, RequestContext, User } from "../types/identity.js" */

/**
 * Resultado de um login concluido: usuario publico, JWT da sessao e sua validade (cookie).
 * @typedef {object} LoginResult
 * @property {PublicUser} user
 * @property {string} token
 * @property {AuthSession} session
 * @property {number} maxAgeSeconds
 */

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const THROTTLED_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

/**
 * @param {unknown} code
 * @returns {string} SHA-256 hexadecimal do codigo normalizado.
 */
export function hashRecoveryCode(code) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

function invalidCredentials() {
  return unauthorized(GENERIC_LOGIN_ERROR, { code: "INVALID_CREDENTIALS" });
}

/**
 * @param {string} type Evento (`auth`, `auth_login_failed`...).
 * @param {string} message
 * @param {string | null} userId
 * @param {RequestContext} [context]
 * @param {Record<string, unknown>} [meta]
 * @returns {Promise<void>}
 */
export async function auditAuth(type, message, userId, context = {}, meta = {}) {
  authEvents.inc({ event: type });
  try {
    await addLog({
      type,
      message,
      userId,
      meta: { ip: context.ip || null, userAgent: context.userAgent || null, ...meta }
    });
  } catch {
    // Falha de auditoria nao pode derrubar o login; o erro aparece nos logs HTTP.
  }
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * @param {unknown} setupToken
 * @returns {void}
 */
function assertSetupAllowed(setupToken) {
  if (!isProductionLike) return;
  const expected = getAuthConfig().setupToken;
  if (!expected) {
    throw forbidden(
      "O cadastro inicial pela internet está desativado. Crie o primeiro administrador com `npm run seed:admin` ou defina SETUP_TOKEN.",
      { code: "SETUP_DISABLED" }
    );
  }
  if (!setupToken || !constantTimeEquals(setupToken, expected)) {
    throw forbidden("Token de configuração inicial inválido.", { code: "SETUP_TOKEN_INVALID" });
  }
}

/**
 * @param {{ name?: unknown, email?: unknown, password?: unknown, setupToken?: unknown }} input
 * @param {RequestContext} [context]
 * @returns {Promise<LoginResult>}
 */
export async function registerFirstAdmin({ name, email, password, setupToken }, context = {}) {
  assertSetupAllowed(setupToken);
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanName || !cleanEmail || !cleanEmail.includes("@")) {
    throw badRequest("Informe nome, e-mail válido e senha.");
  }
  assertValidPassword(password, { email: cleanEmail, name: cleanName });

  const passwordHash = await hashPassword(password);
  const created = await withTransaction(async (db) => {
    if (resolveDatabaseConfig().mode === "postgres") {
      await db("SELECT pg_advisory_xact_lock($1)", [813_724_602]);
    }
    /** @type {QueryResult<{ total: number }>} */
    const admins = await db(
      "SELECT COUNT(*)::int AS total FROM users WHERE active = TRUE AND (role = 'admin' OR is_admin = TRUE)"
    );
    if (Number(admins.rows[0]?.total || 0) > 0) return null;
    /** @type {QueryResult<{ id: string }>} */
    const inserted = await db(
      `
        INSERT INTO users (id, name, email, password_hash, role, is_admin, active, permissions, password_changed_at)
        VALUES ($4, $1, $2, $3, 'admin', TRUE, TRUE, '["admin.full"]'::jsonb, NOW())
        RETURNING id
      `,
      [cleanName, cleanEmail, passwordHash, randomUUID()]
    );
    return inserted.rows[0].id;
  });
  if (!created) {
    throw forbidden("Cadastro público desativado. Solicite acesso a um administrador.");
  }

  const user = await findUserById(created);
  if (!user) throw forbidden("Cadastro público desativado. Solicite acesso a um administrador.");
  await auditAuth("auth_first_admin", "Primeiro administrador cadastrado.", user.id, context);
  const { token, session, maxAgeSeconds } = await startSession(user, context);
  return { user: toPublicUser(user), token, session, maxAgeSeconds };
}

/**
 * @param {User} user
 * @param {unknown} password
 * @param {RequestContext} context
 * @returns {Promise<LoginResult>}
 */
async function finishLogin(user, password, context) {
  await recordSuccessfulLogin(user.id);
  if (passwordNeedsRehash(user.passwordHash)) {
    // Custo de bcrypt aumentou desde que a senha foi gravada: regrava em
    // silencio, sem invalidar sessoes (a senha em si nao mudou).
    const upgraded = await hashPassword(password);
    await query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, upgraded]);
  }
  const fresh = (await findUserById(user.id)) || user;
  const { token, session, maxAgeSeconds } = await startSession(fresh, context);
  await auditAuth("auth", "Login realizado.", fresh.id, context, { sessionId: session.id });
  return { user: toPublicUser(fresh), token, session, maxAgeSeconds };
}

/**
 * @param {User} user
 * @returns {void}
 */
function assertNotLocked(user) {
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    throw tooManyRequests(THROTTLED_MESSAGE, { code: "ACCOUNT_LOCKED" });
  }
}

/**
 * @param {User} user
 * @param {RequestContext} context
 * @param {string} reason
 * @returns {Promise<void>}
 */
async function registerFailure(user, context, reason) {
  const config = getAuthConfig();
  const result = await recordFailedLogin(user.id, {
    threshold: config.lockoutThreshold,
    lockoutSeconds: config.lockoutSeconds
  });
  await auditAuth("auth_login_failed", `Falha de login (${reason}).`, user.id, context, { attempts: result.attempts });
  if (result.lockedUntil) {
    await auditAuth("auth_lockout", "Conta bloqueada temporariamente por tentativas seguidas.", user.id, context, {
      lockedUntil: result.lockedUntil
    });
  }
}

/**
 * Passo 1 do login. Devolve { mfaRequired, mfaToken } quando o usuario tem
 * MFA, ou ja a sessao quando nao tem. O tempo de resposta e parecido para
 * e-mail inexistente, bloqueado e senha errada (compara contra um hash
 * descartavel), para nao revelar quais contas existem.
 *
 * @param {{ email?: unknown, password?: unknown }} credentials
 * @param {RequestContext} [context]
 * @returns {Promise<{ mfaRequired: true, mfaToken: string } | ({ mfaRequired: false } & LoginResult)>}
 */
export async function authenticateWithCredentials({ email, password }, context = {}) {
  const user = await findUserByEmail(String(email || "").trim());

  if (!user || user.active === false) {
    await burnPasswordComparison(password);
    await auditAuth("auth_login_failed", "Falha de login (usuário desconhecido ou inativo).", null, context, {
      email: String(email || "").trim().toLowerCase().slice(0, 120)
    });
    throw invalidCredentials();
  }
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    await burnPasswordComparison(password);
    throw tooManyRequests(THROTTLED_MESSAGE, { code: "ACCOUNT_LOCKED" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await registerFailure(user, context, "senha incorreta");
    throw invalidCredentials();
  }

  if (user.mfaEnabled) {
    return { mfaRequired: true, mfaToken: issueMfaChallengeToken(user.id) };
  }
  return { mfaRequired: false, ...(await finishLogin(user, password, context)) };
}

/**
 * @param {User} user
 * @param {{ code?: unknown, recoveryCode?: unknown }} factor
 * @returns {Promise<boolean>}
 */
async function verifySecondFactor(user, { code, recoveryCode }) {
  const state = await getSecurityState(user.id);
  if (recoveryCode) {
    return consumeRecoveryCode(user.id, hashRecoveryCode(recoveryCode));
  }
  if (!code || !state?.mfaSecretEncrypted) return false;
  const step = verifyTotp(openSecret(state.mfaSecretEncrypted), code, { lastUsedStep: state.mfaLastUsedStep });
  if (step === null) return false;
  return claimMfaStep(user.id, step);
}

/**
 * Passo 2 do login: troca o desafio MFA + codigo (ou codigo de recuperacao) por uma sessao.
 *
 * @param {{ mfaToken?: unknown, code?: unknown, recoveryCode?: unknown }} input
 * @param {RequestContext} [context]
 * @returns {Promise<LoginResult>}
 */
export async function completeMfaLogin({ mfaToken, code, recoveryCode }, context = {}) {
  const userId = verifyMfaChallengeToken(String(mfaToken || ""));
  const user = await findUserById(userId);
  if (!user || user.active === false || !user.mfaEnabled) {
    throw unauthorized("A verificação expirou. Informe e-mail e senha novamente.", { code: "MFA_CHALLENGE_INVALID" });
  }
  assertNotLocked(user);

  const ok = await verifySecondFactor(user, { code, recoveryCode });
  if (!ok) {
    await registerFailure(user, context, "código MFA incorreto");
    throw unauthorized("Código de verificação inválido.", { code: "MFA_CODE_INVALID" });
  }
  if (recoveryCode) {
    await auditAuth("auth_recovery_code_used", "Código de recuperação MFA utilizado no login.", user.id, context);
  }
  // A senha ja foi comprovada no passo 1 (o desafio so e emitido depois dela).
  await recordSuccessfulLogin(user.id);
  const fresh = (await findUserById(user.id)) || user;
  const { token, session, maxAgeSeconds } = await startSession(fresh, context);
  await auditAuth("auth", "Login realizado (MFA).", fresh.id, context, { sessionId: session.id });
  return { user: toPublicUser(fresh), token, session, maxAgeSeconds };
}

/**
 * Troca de senha pelo proprio usuario. Revoga todas as sessoes (inclusive de
 * outros dispositivos) e abre uma nova para o dispositivo atual.
 *
 * @param {{ id: string }} user
 * @param {{ currentPassword?: unknown, newPassword?: unknown }} passwords
 * @param {RequestContext} [context]
 * @returns {Promise<LoginResult>}
 */
export async function changeOwnPassword(user, { currentPassword, newPassword }, context = {}) {
  const stored = await findUserById(user.id);
  if (!stored) throw unauthorized("Sessão inválida.");
  const valid = await verifyPassword(currentPassword, stored.passwordHash);
  if (!valid) {
    await auditAuth("auth_password_change_failed", "Senha atual incorreta ao trocar a senha.", user.id, context);
    throw unauthorized("A senha atual está incorreta.", { code: "CURRENT_PASSWORD_INVALID" });
  }
  assertValidPassword(newPassword, { email: stored.email, name: stored.name });
  if (await verifyPassword(newPassword, stored.passwordHash)) {
    throw badRequest("A nova senha precisa ser diferente da atual.", { code: "PASSWORD_REUSED" });
  }

  const newHash = await hashPassword(newPassword);
  await setUserPassword(user.id, newHash, { mustChangePassword: false });
  await revokeAllSessions(user.id, "password_changed");
  const fresh = await findUserById(user.id);
  if (!fresh) throw unauthorized("Sessão inválida.");
  const { token, session, maxAgeSeconds } = await startSession(fresh, context);
  await auditAuth("auth_password_changed", "Senha alterada pelo próprio usuário.", user.id, context);
  return { user: toPublicUser(fresh), token, session, maxAgeSeconds };
}

/**
 * @param {{ id: string }} user
 * @param {string | null | undefined} currentSessionId Sessao preservada (a do dispositivo atual).
 * @param {RequestContext} [context]
 * @returns {Promise<number | null>} Quantidade de sessoes encerradas.
 */
export async function logoutEverywhere(user, currentSessionId, context = {}) {
  const revoked = await revokeAllSessions(user.id, "logout_everywhere", { exceptSessionId: currentSessionId });
  await auditAuth("auth_sessions_revoked", "Outras sessões encerradas pelo usuário.", user.id, context, { revoked });
  return revoked;
}
