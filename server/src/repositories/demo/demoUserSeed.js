import { query } from "../../database.js";
import { normalizePermissions } from "../../permissions.js";
import { hashPassword } from "../../security/passwordHasher.js";
import { demoUsers } from "./demoUserData.js";

// Todos os usuarios de demonstracao entram com a mesma senha inicial.
const demoUserPassword = "123456";

export async function seedDemoUsers() {
  const passwordHash = await hashPassword(demoUserPassword);

  for (const user of demoUsers) {
    await query(
      `
        INSERT INTO users (
          id, name, email, password_hash, role, active, sector_id, job_title, is_admin, permissions
        )
        VALUES ($1, $2, LOWER($3), $4, $5, TRUE, $6, $7, $8, $9::jsonb)
        ON CONFLICT (email) DO NOTHING
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

