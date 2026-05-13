import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "../database.js";

export async function listUsers() {
  const result = await query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC"
  );
  return result.rows.map((row) => toPublicUser(fromRow(row)));
}

export async function findUserByEmail(email) {
  const result = await query(
    "SELECT id, name, email, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function findUserById(id) {
  const result = await query(
    "SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createUser({ name, email, password }) {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, LOWER($3), $4, 'operator')
        RETURNING id, name, email, password_hash, role, created_at
      `,
      [randomUUID(), name, email, passwordHash]
    );

    return fromRow(result.rows[0]);
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
      SET role = $2
      WHERE id = $1
      RETURNING id, name, email, role, created_at
    `,
    [id, role]
  );

  return result.rows[0] ? toPublicUser(fromRow(result.rows[0])) : null;
}

export async function seedDefaultAdmin() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  await query(
    `
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, 'admin')
      ON CONFLICT (email) DO NOTHING
    `,
    ["seed-admin", "IT Guardian Admin", "admin@itguardian.local", passwordHash]
  );
}

export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at
  };
}
