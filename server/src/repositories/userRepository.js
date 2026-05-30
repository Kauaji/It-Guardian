import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../database.js";
import { getEffectivePermissions, normalizePermissions } from "../permissions.js";

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
    sectors.name AS sector_name,
    CASE
      WHEN sectors.active = TRUE THEN sectors.permissions
      ELSE '[]'::jsonb
    END AS sector_permissions
  FROM users
  LEFT JOIN sectors ON sectors.id = users.sector_id
`;

export async function listUsers() {
  const result = await query(
    `${userSelect} ORDER BY users.created_at DESC`
  );
  return result.rows.map((row) => toPublicUser(fromRow(row)));
}

export async function findUserByEmail(email) {
  const result = await query(
    `${userSelect} WHERE LOWER(users.email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function findUserById(id) {
  const result = await query(
    `${userSelect} WHERE users.id = $1`,
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createUser({
  name,
  email,
  password,
  role = "viewer",
  active = true,
  sectorId = null,
  jobTitle = "",
  permissions = []
}) {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedPermissions = normalizePermissions(permissions);
    const isAdmin = role === "admin";
    const result = await query(
      `
        INSERT INTO users (id, name, email, password_hash, role, active, sector_id, job_title, is_admin, permissions)
        VALUES ($1, $2, LOWER($3), $4, $5, $6, $7, $8, $9, $10::jsonb)
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
        JSON.stringify(normalizedPermissions)
      ]
    );

    return findUserById(result.rows[0].id);
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error("Email is already registered");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
}

export async function updateUserRole(id, role) {
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

  return result.rows[0] ? toPublicUser(await findUserById(result.rows[0].id)) : null;
}

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

  return result.rows[0] ? toPublicUser(await findUserById(result.rows[0].id)) : null;
}

export async function updateUserPermissions(id, permissions = []) {
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

  return result.rows[0] ? toPublicUser(await findUserById(result.rows[0].id)) : null;
}

export async function deactivateUser(id) {
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

  return result.rows[0] ? toPublicUser(await findUserById(result.rows[0].id)) : null;
}

export async function countActiveAdminsExcluding(userId = "") {
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

export async function seedDefaultAdmin() {
  const passwordHash = await bcrypt.hash("123456", 10);
  await query(
    `
      INSERT INTO users (id, name, email, password_hash, role, is_admin, active, sector_id, job_title, permissions)
      VALUES ($1, $2, $3, $4, 'admin', TRUE, TRUE, $5, $6, $7::jsonb)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'admin',
        is_admin = TRUE,
        active = TRUE,
        sector_id = EXCLUDED.sector_id,
        job_title = EXCLUDED.job_title,
        permissions = EXCLUDED.permissions,
        updated_at = NOW()
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

export async function seedDemoUsers() {
  const passwordHash = await bcrypt.hash("123456", 10);
  const users = [
    {
      id: "seed-admin",
      name: "Admin Sistema",
      email: "admin@itguardian.local",
      role: "admin",
      sectorId: "sector-administracao",
      jobTitle: "Administrador principal",
      isAdmin: true,
      permissions: ["admin.full"]
    },
    {
      id: "seed-admin-marina",
      name: "Marina Duarte",
      email: "marina.duarte@itguardian.local",
      role: "admin",
      sectorId: "sector-administracao",
      jobTitle: "Administradora auxiliar",
      isAdmin: true,
      permissions: ["admin.full"]
    },
    {
      id: "seed-user-rafael",
      name: "Rafael Nunes",
      email: "rafael.nunes@itguardian.local",
      role: "viewer",
      sectorId: "sector-support-n1",
      jobTitle: "Tecnico N1",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-user-felipe",
      name: "Felipe Castro",
      email: "felipe.castro@itguardian.local",
      role: "viewer",
      sectorId: "sector-suporte-n2",
      jobTitle: "Tecnico avancado",
      isAdmin: false,
      permissions: ["service_orders.edit", "service_orders.parts"]
    },
    {
      id: "seed-user-bruno",
      name: "Bruno Almeida",
      email: "bruno.almeida@itguardian.local",
      role: "viewer",
      sectorId: "sector-infra",
      jobTitle: "Tecnico de infraestrutura",
      isAdmin: false,
      permissions: ["inventory.move_assets"]
    },
    {
      id: "seed-user-camila",
      name: "Camila Rocha",
      email: "camila.rocha@itguardian.local",
      role: "viewer",
      sectorId: "sector-redes",
      jobTitle: "Analista de redes",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-user-patricia",
      name: "Patricia Lima",
      email: "patricia.lima@itguardian.local",
      role: "viewer",
      sectorId: "sector-financeiro",
      jobTitle: "Usuario comum",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-user-andre",
      name: "Andre Torres",
      email: "andre.torres@itguardian.local",
      role: "viewer",
      sectorId: "sector-diretoria",
      jobTitle: "Gestor",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-user-lucas",
      name: "Lucas Pereira",
      email: "lucas.pereira@itguardian.local",
      role: "viewer",
      sectorId: "sector-geral",
      jobTitle: "Usuario novo",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-demo-tecnico-n1",
      name: "Tecnico N1 Demo",
      email: "tecnico.n1@itguardian.local",
      role: "viewer",
      sectorId: "sector-support-n1",
      jobTitle: "Tecnico N1",
      isAdmin: false,
      permissions: []
    },
    {
      id: "seed-demo-tecnico-n2",
      name: "Tecnico N2 Demo",
      email: "tecnico.n2@itguardian.local",
      role: "viewer",
      sectorId: "sector-suporte-n2",
      jobTitle: "Tecnico N2",
      isAdmin: false,
      permissions: ["service_orders.edit", "service_orders.parts"]
    },
    {
      id: "seed-demo-usuario-comum",
      name: "Usuario Comum Demo",
      email: "usuario.comum@itguardian.local",
      role: "viewer",
      sectorId: "sector-geral",
      jobTitle: "Solicitante",
      isAdmin: false,
      permissions: ["service_orders.view", "service_orders.create"]
    },
    {
      id: "seed-demo-sem-permissao",
      name: "Sem Permissao Demo",
      email: "sem.permissao@itguardian.local",
      role: "viewer",
      sectorId: "sector-geral",
      jobTitle: "Usuario sem permissao",
      isAdmin: false,
      permissions: []
    }
  ];

  for (const user of users) {
    await query(
      `
        INSERT INTO users (
          id, name, email, password_hash, role, active, sector_id, job_title, is_admin, permissions
        )
        VALUES ($1, $2, LOWER($3), $4, $5, TRUE, $6, $7, $8, $9::jsonb)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          active = TRUE,
          sector_id = EXCLUDED.sector_id,
          job_title = EXCLUDED.job_title,
          is_admin = EXCLUDED.is_admin,
          permissions = EXCLUDED.permissions,
          updated_at = NOW()
      `,
      [
        user.id,
        user.name,
        user.email,
        passwordHash,
        user.role,
        user.sectorId,
        user.jobTitle,
        user.isAdmin,
        JSON.stringify(normalizePermissions(user.permissions))
      ]
    );
  }
}

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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
