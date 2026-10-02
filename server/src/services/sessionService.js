import jwt from "jsonwebtoken";
import { getAuthConfig, getJwtSecret } from "../config/environment.js";
import { unauthorized } from "../lib/errors.js";
import {
  createAuthSession,
  findAuthSession,
  listActiveAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
  touchAuthSession
} from "../repositories/authSessionRepository.js";
import { findUserById } from "../repositories/userRepository.js";

const SESSION_TYPE = "session";
const MFA_TYPE = "mfa";
const ALGORITHMS = ["HS256"];
const TOUCH_INTERVAL_MS = 60_000;

function signSessionToken({ userId, sessionId, tokenVersion, expiresInSeconds }) {
  return jwt.sign(
    { sub: userId, sid: sessionId, ver: tokenVersion, typ: SESSION_TYPE },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: Math.max(1, Math.floor(expiresInSeconds)) }
  );
}

/**
 * Abre uma sessao: grava a linha em auth_sessions (revogavel, com vida maxima
 * absoluta) e devolve o JWT que a representa.
 */
export async function startSession(user, { ip = null, userAgent = null } = {}) {
  const config = getAuthConfig();
  const absoluteExpiresAt = new Date(Date.now() + config.absoluteSeconds * 1000);
  const session = await createAuthSession({
    userId: user.id,
    tokenVersion: user.tokenVersion ?? 0,
    absoluteExpiresAt,
    ip,
    userAgent
  });
  const token = signSessionToken({
    userId: user.id,
    sessionId: session.id,
    tokenVersion: session.tokenVersion,
    expiresInSeconds: Math.min(config.idleSeconds, config.absoluteSeconds)
  });
  return { token, session, maxAgeSeconds: Math.min(config.idleSeconds, config.absoluteSeconds) };
}

function invalidSession(message = "Sessão inválida ou expirada. Entre novamente.", code = "SESSION_INVALID") {
  return unauthorized(message, { code });
}

/**
 * Valida um token de sessao ponta a ponta: assinatura, tipo, sessao nao
 * revogada, dentro da vida maxima, versao de token igual a do usuario e
 * usuario ativo. Usada pelo HTTP e pelo WebSocket.
 */
export async function authenticateSessionToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ALGORITHMS });
  } catch {
    throw invalidSession();
  }
  if (payload.typ !== SESSION_TYPE || !payload.sid || !payload.sub) throw invalidSession();

  const [session, user] = await Promise.all([findAuthSession(payload.sid), findUserById(payload.sub)]);
  if (!session || session.userId !== payload.sub || session.revokedAt) throw invalidSession();
  if (new Date(session.absoluteExpiresAt).getTime() <= Date.now()) throw invalidSession();
  if (!user || user.active === false) throw invalidSession();
  if (Number(payload.ver) !== user.tokenVersion || session.tokenVersion !== user.tokenVersion) {
    throw invalidSession();
  }

  if (Date.now() - new Date(session.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    touchAuthSession(session.id).catch(() => {});
  }
  return { user, session, payload };
}

/**
 * Renova o token (mesma sessao) depois de `rotateAfterSeconds`, sem nunca
 * ultrapassar a vida maxima absoluta -- e isto que impede um token roubado de
 * se renovar para sempre.
 */
export function rotateSessionTokenIfNeeded({ token, payload, session, user }) {
  const config = getAuthConfig();
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - Number(payload.iat || 0) < config.rotateAfterSeconds) {
    return { token, rotated: false, maxAgeSeconds: Math.max(1, Number(payload.exp) - nowSeconds) };
  }
  const absoluteRemaining = Math.floor(new Date(session.absoluteExpiresAt).getTime() / 1000) - nowSeconds;
  const expiresInSeconds = Math.min(config.idleSeconds, absoluteRemaining);
  const rotatedToken = signSessionToken({
    userId: user.id,
    sessionId: session.id,
    tokenVersion: user.tokenVersion,
    expiresInSeconds
  });
  return { token: rotatedToken, rotated: true, maxAgeSeconds: expiresInSeconds };
}

export function issueMfaChallengeToken(userId) {
  return jwt.sign({ sub: userId, typ: MFA_TYPE }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: getAuthConfig().mfaTokenSeconds
  });
}

export function verifyMfaChallengeToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ALGORITHMS });
    if (payload.typ !== MFA_TYPE || !payload.sub) throw new Error("tipo");
    return payload.sub;
  } catch {
    throw unauthorized("A verificação expirou. Informe e-mail e senha novamente.", { code: "MFA_CHALLENGE_INVALID" });
  }
}

export function listUserSessions(userId) {
  return listActiveAuthSessions(userId);
}

export function revokeSession(sessionId, userId, reason) {
  return revokeAuthSession(sessionId, userId, reason);
}

export function revokeAllSessions(userId, reason, options) {
  return revokeAllAuthSessions(userId, reason, options);
}
