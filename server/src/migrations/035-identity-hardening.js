import { resolveDatabaseConfig } from "../config/environment.js";

export const migration035IdentityHardening = {
  id: "035-identity-hardening",
  async up(db) {
    await db(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lockout_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS mfa_pending_secret_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS mfa_confirmed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT;
    `);

    // Uma linha por sessao ativa: permite revogar uma sessao especifica,
    // listar dispositivos e impor vida maxima absoluta (o JWT sozinho nao
    // consegue ser revogado).
    await db(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        absolute_expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        ip TEXT,
        user_agent TEXT
      );
    `);
    await db("CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(absolute_expires_at);");

    await db(`
      CREATE TABLE IF NOT EXISTS user_recovery_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db("CREATE INDEX IF NOT EXISTS idx_user_recovery_codes_user ON user_recovery_codes(user_id);");

    // Vinculo explicito tecnico <-> usuario. Antes, o escopo de clientes do
    // tecnico era resolvido casando e-mail OU nome de exibicao -- um valor
    // nao unico e editavel. O backfill abaixo preserva os vinculos que
    // existiam implicitamente (e-mail exato; ou nome exato quando so um
    // usuario tem aquele nome) para nao alargar o acesso de ninguem.
    await db("ALTER TABLE technicians ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;");
    await db("CREATE INDEX IF NOT EXISTS idx_technicians_user ON technicians(user_id);");

    const users = (await db("SELECT id, name, email FROM users")).rows;
    const technicians = (await db("SELECT id, name, email FROM technicians WHERE user_id IS NULL")).rows;
    const byEmail = new Map(users.map((user) => [String(user.email || "").toLowerCase(), user]));
    const namesCount = new Map();
    for (const user of users) {
      const key = String(user.name || "").trim().toLowerCase();
      namesCount.set(key, (namesCount.get(key) || 0) + 1);
    }
    for (const technician of technicians) {
      const emailKey = String(technician.email || "").trim().toLowerCase();
      const nameKey = String(technician.name || "").trim().toLowerCase();
      let match = emailKey ? byEmail.get(emailKey) : null;
      if (!match && nameKey && namesCount.get(nameKey) === 1) {
        match = users.find((user) => String(user.name || "").trim().toLowerCase() === nameKey);
      }
      if (match) {
        await db("UPDATE technicians SET user_id = $2 WHERE id = $1", [technician.id, match.id]);
      }
    }

    if (resolveDatabaseConfig().mode === "postgres") {
      await db("ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;");
      await db("ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;");
    }
  }
};
