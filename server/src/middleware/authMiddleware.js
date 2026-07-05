import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";
import { query } from "../database.js";
import { findUserById } from "../repositories/userRepository.js";
import { hasPermission } from "../permissions.js";
import { readSessionCookie } from "../security/sessionCookie.js";

function normalizeClientIds(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, bearerToken] = header.split(" ");
    const token = bearerToken || readSessionCookie(req);

    if (!token) {
      return res.status(401).json({ message: "Authentication token is required" });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await findUserById(payload.sub);

    if (!user || user.active === false) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    const technicianResult = await query(
      `
        SELECT allowed_client_ids
        FROM technicians
        WHERE active = TRUE
          AND (
            LOWER(email) = LOWER($1)
            OR LOWER(name) = LOWER($2)
          )
        LIMIT 1
      `,
      [user.email || "", user.name || ""]
    );
    const technicianAccess = technicianResult.rows[0];

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
      allowedClientIds: normalizeClientIds(technicianAccess?.allowed_client_ids),
      allowedEnvironmentIds: normalizeClientIds(user.allowedEnvironmentIds),
      allowedGroupIds: normalizeClientIds(user.allowedGroupIds),
      allowedSegmentIds: normalizeClientIds(user.allowedSegmentIds)
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired authentication token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role) && !req.user?.isAdmin) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }

    return next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.isAdmin) return next();
  return res.status(403).json({ message: "Apenas administradores podem acessar esta area." });
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (hasPermission(req.user, permission)) return next();
    return res.status(403).json({ message: "Voce nao possui permissao para acessar este modulo." });
  };
}
