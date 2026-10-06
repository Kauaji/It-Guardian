import { getAuthConfig } from "../config/environment.js";
import { query } from "../database.js";
import { hasPermission } from "../permissions.js";
import { readSessionCookie } from "../security/sessionCookie.js";
import { authenticateSessionToken } from "../services/sessionService.js";

/** @import { NextFunction, Request, Response } from "express" */
/** @import { HttpErrorLike } from "../lib/errors.js" */
/** @import { RequestUser, User } from "../types/identity.js" */
/** @import { QueryResult } from "pg" */

/**
 * @param {unknown} value
 * @returns {string[]} Ids como texto aparado, sem vazios (nao lista vira `[]`).
 */
function normalizeClientIds(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

// Rotas liberadas enquanto a conta ainda precisa trocar a senha ou cadastrar
// o MFA: so o necessario para regularizar a conta e sair.
/** @type {Set<string>} */
const PASSWORD_CHANGE_ALLOWED = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/password"
]);
/** @type {Set<string>} */
const MFA_ENROLLMENT_ALLOWED = new Set([
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/password",
  "/api/auth/mfa/status",
  "/api/auth/mfa/setup",
  "/api/auth/mfa/enable"
]);

/**
 * @param {Request} req
 * @returns {string} Token Bearer ou do cookie de sessao ("" quando ausente).
 */
function readToken(req) {
  const header = String(req.headers.authorization || "");
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || readSessionCookie(req);
}

/**
 * Escopo de clientes do tecnico vinculado ao usuario. O vinculo e explicito
 * (technicians.user_id); para tecnicos ainda sem vinculo cai no e-mail exato.
 * O nome de exibicao NUNCA e usado: nao e unico nem imutavel.
 *
 * @param {Pick<User, "id" | "email">} user
 * @returns {Promise<string[]>}
 */
async function loadTechnicianScope(user) {
  /** @type {QueryResult<{ allowed_client_ids: unknown }>} */
  const result = await query(
    `
      SELECT allowed_client_ids
      FROM technicians
      WHERE active = TRUE
        AND (user_id = $1 OR (user_id IS NULL AND email IS NOT NULL AND LOWER(email) = LOWER($2)))
      ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    `,
    [user.id, user.email || ""]
  );
  return normalizeClientIds(result.rows[0]?.allowed_client_ids);
}

/**
 * @param {User} user
 * @returns {{ allowed: Set<string>, code: string, message: string } | null}
 */
function accountRestriction(user) {
  if (user.mustChangePassword) {
    return { allowed: PASSWORD_CHANGE_ALLOWED, code: "PASSWORD_CHANGE_REQUIRED", message: "Troque a senha para continuar." };
  }
  if (user.isAdmin && getAuthConfig().mfaRequiredForAdmins && !user.mfaEnabled) {
    return {
      allowed: MFA_ENROLLMENT_ALLOWED,
      code: "MFA_ENROLLMENT_REQUIRED",
      message: "Cadastre a verificação em duas etapas para continuar."
    };
  }
  return null;
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {Promise<void | Response>}
 */
export async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      return res.status(401).json({
        message: "Entre para continuar.",
        code: "AUTH_REQUIRED",
        statusCode: 401,
        requestId: req.requestId
      });
    }

    const { user, session, payload } = await authenticateSessionToken(token);

    const restriction = accountRestriction(user);
    if (restriction && !restriction.allowed.has(`${req.baseUrl}${req.path}`.replace(/\/$/, ""))) {
      return res.status(403).json({
        message: restriction.message,
        code: restriction.code,
        statusCode: 403,
        requestId: req.requestId
      });
    }

    req.auth = { token, payload, session };
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      sectorId: user.sectorId,
      sectorName: user.sectorName,
      jobTitle: user.jobTitle,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      sectorPermissions: user.sectorPermissions,
      effectivePermissions: user.effectivePermissions,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePassword,
      allowedClientIds: await loadTechnicianScope(user),
      allowedEnvironmentIds: normalizeClientIds(user.allowedEnvironmentIds),
      allowedGroupIds: normalizeClientIds(user.allowedGroupIds),
      allowedSegmentIds: normalizeClientIds(user.allowedSegmentIds)
    };
    return next();
  } catch (error) {
    const failure = /** @type {HttpErrorLike} */ (error);
    if (failure.statusCode === 401) {
      return res.status(401).json({
        message: failure.message,
        code: failure.code || "SESSION_INVALID",
        statusCode: 401,
        requestId: req.requestId
      });
    }
    return next(error);
  }
}

/**
 * @param {...string} roles
 * @returns {(req: Request, res: Response, next: NextFunction) => void | Response}
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if ((role === undefined || !roles.includes(role)) && !req.user?.isAdmin) {
      return res.status(403).json({ message: "Você não tem permissão para realizar esta ação." });
    }

    return next();
  };
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @returns {void | Response}
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.isAdmin) return next();
  return res.status(403).json({ message: "Apenas administradores podem acessar esta área." });
}

/**
 * @param {string} permission
 * @returns {(req: Request, res: Response, next: NextFunction) => void | Response}
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (hasPermission(req.user, permission)) return next();
    return res.status(403).json({ message: "Você não possui permissão para acessar este módulo." });
  };
}

/**
 * @param {...string} permissions
 * @returns {(req: Request, res: Response, next: NextFunction) => void | Response}
 */
export function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (permissions.some((permission) => hasPermission(req.user, permission))) return next();
    return res.status(403).json({ message: "Você não possui permissão para acessar este módulo." });
  };
}
