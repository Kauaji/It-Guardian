import { randomUUID } from "node:crypto";
import { hashPassword } from "../security/passwordHasher.js";
import { query } from "../database.js";
import { getEffectivePermissions, normalizePermissions } from "../permissions.js";

/** @import { QueryResult } from "pg" */
/** @import { HttpErrorLike } from "../lib/errors.js" */
/** @import { PublicUser, User, UserRow } from "../types/identity.js" */

/**
 * Corpo de atualizacao de acesso (so as chaves presentes mudam o usuario).
 * @typedef {object} UserAccessPayload
 * @property {string} [role]
 * @property {boolean} [isAdmin]
 * @property {unknown} [permissions]
 * @property {string} [name]
 * @property {string | null} [sectorId]
 * @property {string | null} [jobTitle]
 * @property {boolean} [active]
 */

const userSelect = `
  SELECT
    users.id,
    users.name,
    users.email,
    users.password_hash,
    users.role,
    users.active,
    users.sector_id,
    users.job_title,
    users.is_admin,
    users.permissions,
    users.created_at,
    users.updated_at,
    users.token_version,
    users.must_change_password,
    users.password_changed_at,
    users.failed_login_attempts,
    users.lockout_count,
    users.locked_until,
    users.last_login_at,
    users.mfa_enabled,
    sectors.name AS sector_name,
    CASE
      WHEN sectors.active = TRUE THEN sectors.permissions
      ELSE '[]'::jsonb
    END AS sector_permissions
  FROM users
  LEFT JOIN sectors ON sectors.id = users.sector_id
`;

/**
 * @returns {Promise<PublicUser[]>}
 */
export async function listUsers() {
  /** @type {QueryResult<UserRow>} */
  const result = await query(
    `${userSelect} ORDER BY users.created_at DESC`
  );
  return result.rows.map((row) => toPublicUser(fromRow(row)));
}

/**
 * @param {string} email
 * @returns {Promise<User | null>}
 */
export async function findUserByEmail(email) {
  /** @type {QueryResult<UserRow>} */
  const result = await query(
    `${userSelect} WHERE LOWER(users.email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

/**
 * @param {string} id
 * @returns {Promise<User | null>}
 */
export async function findUserById(id) {
  /** @type {QueryResult<UserRow>} */
  const result = await query(
    `${userSelect} WHERE users.id = $1`,
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

/**
 * @param {{ name: string, email: string, password: string, role?: string, active?: boolean, sectorId?: string | null, jobTitle?: string, permissions?: unknown, mustChangePassword?: boolean }} input
 * @returns {Promise<User | null>}
 * @throws {Error} 409 quando o e-mail ja existe.
 */
export async function createUser({
  name,
  email,
  password,
  role = "viewer",
  active = true,
  sectorId = null,
  jobTitle = "",
  permissions = [],
  mustChangePassword = false
}) {
  try {
    const passwordHash = await hashPassword(password);
    const normalizedPermissions = normalizePermissions(permissions);
    const isAdmin = role === "admin";
    /** @type {QueryResult<{ id: string }>} */
    const result = await query(
      `
        INSERT INTO users (
          id, name, email, password_hash, role, active, sector_id, job_title, is_admin, permissions,
          must_change_password, password_changed_at
        )
        VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10::jsonb, $11, NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        name,
        email,
        passwordHash,
        role,
        Boolean(active),
        sectorId || null,
        jobTitle || null,
        isAdmin,
        JSON.stringify(normalizedPermissions),
        Boolean(mustChangePassword)
      ]
    );

    return findUserById(result.rows[0].id);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      /** @type {HttpErrorLike} */
      const conflict = new Error("Este e-mail já está cadastrado.");
      conflict.statusCode = 409;
      conflict.expose = true;
      throw conflict;
    }
    throw error;
  }
}

/**
 * @param {string} id
 * @returns {Promise<PublicUser | null>} `null` quando o usuario sumiu entre a escrita e a leitura.
 */
async function loadPublicUser(id) {
  const user = await findUserById(id);
  return user ? toPublicUser(user) : null;
}

/**
 * @param {string} id
 * @param {string} role
 * @returns {Promise<PublicUser | null>}
 */
export async function updateUserRole(id, role) {
  /** @type {QueryResult<{ id: string }>} */
  const result = await query(
    `
      UPDATE users
      SET role = $2,
          is_admin = $2 = 'admin',
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id, role]
  );

  return result.rows[0] ? loadPublicUser(result.rows[0].id) : null;
}

/**
 * @param {string} id
 * @param {UserAccessPayload} [payload]
 * @returns {Promise<PublicUser | null>}
 */
export async function updateUserAccess(id, payload = {}) {
  const current = await findUserById(id);
  if (!current) return null;

  let role = payload.role ?? current.role;
  if (payload.isAdmin === true) role = "admin";
  if (payload.isAdmin === false && current.isAdmin && payload.role === undefined) role = "operator";

  const normalizedPermissions = Object.prototype.hasOwnProperty.call(payload, "permissions")
    ? normalizePermissions(payload.permissions)
    : current.permissions;
  const nextName = Object.prototype.hasOwnProperty.call(payload, "name") && payload.name?.trim()
    ? payload.name.trim()
    : current.name;
  const nextSectorId = Object.prototype.hasOwnProperty.call(payload, "sectorId")
    ? payload.sectorId || null
    : current.sectorId || null;
  const nextJobTitle = Object.prototype.hasOwnProperty.call(payload, "jobTitle")
    ? payload.jobTitle || null
    : current.jobTitle || null;
  /** @type {QueryResult<{ id: string }>} */
  const result = await query(
    `
      UPDATE users
      SET name = $2,
          role = $3,
          active = $4,
          sector_id = $5,
          job_title = $6,
          is_admin = $7,
          permissions = $8::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      id,
      nextName,
      role,
      Object.prototype.hasOwnProperty.call(payload, "active") ? payload.active !== false : current.active,
      nextSectorId,
      nextJobTitle,
      role === "admin",
      JSON.stringify(normalizedPermissions)
    ]
  );

  return result.rows[0] ? loadPublicUser(result.rows[0].id) : null;
}

/**
 * @param {string} id
 * @param {unknown} [permissions]
 * @returns {Promise<PublicUser | null>}
 */
export async function updateUserPermissions(id, permissions = []) {
  /** @type {QueryResult<{ id: string }>} */
  const result = await query(
    `
      UPDATE users
      SET permissions = $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id, JSON.stringify(normalizePermissions(permissions))]
  );

  return result.rows[0] ? loadPublicUser(result.rows[0].id) : null;
}

/**
 * @param {string} id
 * @returns {Promise<PublicUser | null>}
 */
export async function deactivateUser(id) {
  /** @type {QueryResult<{ id: string }>} */
  const result = await query(
    `
      UPDATE users
      SET active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0] ? loadPublicUser(result.rows[0].id) : null;
}

/**
 * @param {string} [userId]
 * @returns {Promise<number>}
 */
export async function countActiveAdminsExcluding(userId = "") {
  /** @type {QueryResult<{ total: number }>} */
  const result = await query(
    `
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE active = TRUE
        AND (role = 'admin' OR is_admin = TRUE)
        AND id <> $1
    `,
    [userId]
  );

  return Number(result.rows[0]?.total || 0);
}

/**
 * Seeds de demonstracao SO CRIAM: se o e-mail ja existe, nada e alterado.
 * Antes, ligar a flag num banco existente redefinia a senha para "123456" e
 * devolvia o papel de administrador a cada inicializacao.
 */
export async function seedDefaultAdmin() {
  const passwordHash = await hashPassword("123456");
  await query(
    `
      INSERT INTO users (id, name, email, password_hash, role, is_admin, active, sector_id, job_title, permissions)
      VALUES ($1, $2, $3, $4, 'admin', TRUE, TRUE, $5, $6, $7::jsonb)
      ON CONFLICT (email) DO NOTHING
    `,
    [
      "seed-admin",
      "Admin Sistema",
      "admin@itguardian.local",
      passwordHash,
      "sector-administracao",
      "Administrador principal",
      JSON.stringify(normalizePermissions(["admin.full"]))
    ]
  );
}

/**
 * @param {User} user
 * @returns {PublicUser}
 */
export function toPublicUser(user) {
  return {
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
    effectivePermissions: getEffectivePermissions(user),
    mfaEnabled: Boolean(user.mfaEnabled),
    mustChangePassword: Boolean(user.mustChangePassword),
    passwordChangedAt: user.passwordChangedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * @param {UserRow} row
 * @returns {User}
 */
function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active !== false,
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    jobTitle: row.job_title,
    isAdmin: Boolean(row.is_admin || row.role === "admin"),
    permissions: normalizePermissions(row.permissions),
    sectorPermissions: normalizePermissions(row.sector_permissions),
    tokenVersion: Number(row.token_version || 0),
    mustChangePassword: Boolean(row.must_change_password),
    passwordChangedAt: row.password_changed_at || null,
    failedLoginAttempts: Number(row.failed_login_attempts || 0),
    lockoutCount: Number(row.lockout_count || 0),
    lockedUntil: row.locked_until || null,
    lastLoginAt: row.last_login_at || null,
    mfaEnabled: Boolean(row.mfa_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
