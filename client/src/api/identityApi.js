// Chamadas de identidade: login em 2 passos, troca de senha, MFA, sessoes e
// acoes de administrador sobre contas.
//
// Por que nao usar `apiFetch` direto: ele descarta `body.code`, e aqui o
// codigo estavel (INVALID_CREDENTIALS, MFA_CODE_INVALID...) e justamente o que
// decide o que a interface mostra. Esta camada reaproveita a mesma base de URL
// (API_BASE_URL), cookie (`credentials: include`) e Bearer opcional do api.js.
import { API_BASE_URL } from "../api.js";
import { ACCOUNT_RESTRICTED_EVENT, AUTH_EXPIRED_EVENT } from "../authSession.js";

// Codigos de 401 que significam "a sessao acabou". 401 de credencial errada
// (INVALID_CREDENTIALS, CURRENT_PASSWORD_INVALID, MFA_CODE_INVALID) NAO deslogam.
const SESSION_LOST_CODES = new Set(["SESSION_INVALID", "AUTH_REQUIRED"]);
const RESTRICTION_CODES = new Set(["PASSWORD_CHANGE_REQUIRED", "MFA_ENROLLMENT_REQUIRED"]);

export class IdentityApiError extends Error {
  /**
   * @param {string} message
   * @param {{ statusCode?: number, code?: string, details?: unknown, requestId?: string }} [info]
   * @param {ErrorOptions} [options]
   */
  constructor(message, { statusCode, code, details, requestId } = {}, options = undefined) {
    super(message, options);
    this.name = "IdentityApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
    this.requestId = requestId;
  }
}

/** @param {string} path */
function buildIdentityUrl(path) {
  const baseUrl = String(API_BASE_URL || "").replace(/\/$/, "");
  const apiPrefix = baseUrl.endsWith("/api") ? "" : "/api";
  return `${baseUrl}${apiPrefix}${path}`;
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} detail
 */
function announce(name, detail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * @param {IdentityApiError} error
 * @param {boolean} hadToken
 */
function reactToFailure(error, hadToken) {
  if (error.statusCode === 401 && hadToken && SESSION_LOST_CODES.has(String(error.code))) {
    announce(AUTH_EXPIRED_EVENT, { message: error.message });
  }
  if (error.statusCode === 403 && RESTRICTION_CODES.has(String(error.code))) {
    announce(ACCOUNT_RESTRICTED_EVENT, { code: error.code });
  }
}

/**
 * @param {string} path
 * @param {{ token?: string | null, method?: string, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function identityRequest(path, { token, method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(buildIdentityUrl(path), {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch (cause) {
    throw new IdentityApiError("Não foi possível conectar ao servidor.", { code: "NETWORK_ERROR" }, { cause });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new IdentityApiError(data.message || "Request failed", {
      statusCode: response.status,
      code: data.code,
      details: data.details,
      requestId: data.requestId
    });
    reactToFailure(error, Boolean(token));
    throw error;
  }
  return data;
}

// --- Login e cadastro inicial (sem sessao) ---------------------------------

/** Passo 1: devolve a sessao ({user, token}) ou `{ mfaRequired: true, mfaToken }`. */
/**
 * @param {{ email: string, password: string }} credentials
 */
export function login({ email, password }) {
  return identityRequest("/auth/login", { method: "POST", body: { email, password } });
}

/** Passo 2: `mfaToken` + `code` (TOTP) ou `recoveryCode`. */
/**
 * @param {{ mfaToken: string, code?: string, recoveryCode?: string }} payload
 */
export function loginMfa({ mfaToken, code, recoveryCode }) {
  return identityRequest("/auth/login/mfa", {
    method: "POST",
    body: recoveryCode ? { mfaToken, recoveryCode } : { mfaToken, code }
  });
}

/** Primeiro administrador. Em producao exige `setupToken`. */
/**
 * @param {{ name: string, email: string, password: string, setupToken?: string }} payload
 */
export function register({ name, email, password, setupToken }) {
  return identityRequest("/auth/register", {
    method: "POST",
    body: { name, email, password, ...(setupToken ? { setupToken } : {}) }
  });
}

// --- Conta e sessoes --------------------------------------------------------

/**
 * @param {string} token
 */
export function fetchMe(token) {
  return identityRequest("/auth/me", { token });
}

/** Troca a senha. Devolve uma sessao nova; as demais sessoes sao revogadas. */
/**
 * @param {string} token
 * @param {{ currentPassword: string, newPassword: string }} passwords
 */
export function changePassword(token, { currentPassword, newPassword }) {
  return identityRequest("/auth/password", { token, method: "POST", body: { currentPassword, newPassword } });
}

/** @param {string} token */
export async function fetchSessions(token) {
  const data = await identityRequest("/auth/sessions", { token });
  return data.sessions || [];
}

/**
 * @param {string} token
 * @param {string} sessionId
 */
export function revokeSession(token, sessionId) {
  return identityRequest(`/auth/sessions/${encodeURIComponent(sessionId)}`, { token, method: "DELETE" });
}

/** Devolve `{ revoked }` com a quantidade de sessoes encerradas. */
/**
 * @param {string} token
 */
export function revokeOtherSessions(token) {
  return identityRequest("/auth/sessions/revoke-others", { token, method: "POST" });
}

// --- MFA --------------------------------------------------------------------

/**
 * @param {string} token
 */
export function fetchMfaStatus(token) {
  return identityRequest("/auth/mfa/status", { token });
}

/** Devolve `{ secret, otpauthUri }`. O segredo so vale depois de `enableMfa`. */
/**
 * @param {string} token
 */
export function startMfaSetup(token) {
  return identityRequest("/auth/mfa/setup", { token, method: "POST" });
}

/** Devolve `{ recoveryCodes }` (exibir UMA unica vez). */
/**
 * @param {string} token
 * @param {string} code
 */
export function enableMfa(token, code) {
  return identityRequest("/auth/mfa/enable", { token, method: "POST", body: { code } });
}

// `password` e obrigatoria; alem dela, `code` (TOTP) ou `recoveryCode`.
/**
 * @param {string} token
 * @param {{ password: string, code?: string, recoveryCode?: string }} credentials
 */
export function disableMfa(token, credentials) {
  return identityRequest("/auth/mfa/disable", { token, method: "POST", body: credentials });
}

/**
 * @param {string} token
 * @param {{ password: string, code?: string, recoveryCode?: string }} credentials
 */
export function regenerateRecoveryCodes(token, credentials) {
  return identityRequest("/auth/mfa/recovery-codes", { token, method: "POST", body: credentials });
}

// --- Administracao de contas ------------------------------------------------

/** Devolve `{ temporaryPassword, user }`; a senha so existe nesta resposta. */
/**
 * @param {string} token
 * @param {string} userId
 */
export function adminResetPassword(token, userId) {
  return identityRequest(`/users/${encodeURIComponent(userId)}/reset-password`, { token, method: "POST" });
}

/**
 * @param {string} token
 * @param {string} userId
 */
export function adminResetMfa(token, userId) {
  return identityRequest(`/users/${encodeURIComponent(userId)}/mfa/reset`, { token, method: "POST" });
}
