import { resolveDatabaseConfig } from "../config/environment.js";

/**
 * Tokens de uso unico enviados por e-mail (redefinicao de senha; mesma tabela serve convites).
 * Guarda so o hash SHA-256 do token: um vazamento do banco nao entrega links validos.
 */
export const migration036AuthActionTokens = {
  id: "036-auth-action-tokens",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS auth_action_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        requested_ip TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db("CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_user ON auth_action_tokens(user_id, purpose, used_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_expiry ON auth_action_tokens(expires_at);");

    // Supabase expoe toda tabela do schema public pela API publica: sem RLS, os hashes ficariam acessiveis (ver migracao 014).
    if (resolveDatabaseConfig().mode === "postgres") {
      await db("ALTER TABLE auth_action_tokens ENABLE ROW LEVEL SECURITY;");
    }
  }
};
