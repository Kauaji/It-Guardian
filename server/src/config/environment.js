import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { boundedInteger, isTruthyEnv } from "./envParsing.js";

dotenv.config();
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

export { getRemoteAssistanceConfig } from "./remoteAssistanceConfig.js";

export const isVercel = process.env.VERCEL === "1";
export const vercelEnv = process.env.VERCEL_ENV || "";
export const isProduction = process.env.NODE_ENV === "production";
export const isProductionLike = isProduction || isVercel;

export function isRemoteScriptExecutionEnabled(env = process.env) {
  return isTruthyEnv(env.ENABLE_REMOTE_SCRIPT_EXECUTION);
}

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

// Sem certificado de assinatura em uso ainda, o hash SHA-256 declarado aqui e
// a UNICA verificacao de integridade do binario baixado pelo agente -- o
// mesmo modelo de confianca ja usado para pinagem de conteudo de scripts de
// manutencao (maintenance_scripts.content_updated_by). Por isso as tres
// variaveis sao exigidas em conjunto: uma URL de download sem hash esperado,
// ou um hash sem URL, nao habilita nada.
/**
 * @param {Env} [env]
 * @returns {{ version: string | null, downloadUrl: string | null, sha256: string | null }}
 */
export function getAgentAutoUpdateInfo(env = process.env) {
  const version = String(env.AGENT_LATEST_VERSION || "").trim();
  const downloadUrl = String(env.AGENT_LATEST_VERSION_URL || "").trim();
  const sha256 = String(env.AGENT_LATEST_VERSION_SHA256 || "").trim().toLowerCase();

  if (!version || !downloadUrl || !sha256) {
    return { version: null, downloadUrl: null, sha256: null };
  }
  if (!SHA256_HEX_PATTERN.test(sha256)) {
    return { version: null, downloadUrl: null, sha256: null };
  }
  try {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== "https:") {
      return { version: null, downloadUrl: null, sha256: null };
    }
  } catch {
    return { version: null, downloadUrl: null, sha256: null };
  }

  return { version, downloadUrl, sha256 };
}

/**
 * @param {{ env?: Env, serverless?: boolean }} [options]
 */
export function resolveDatabasePoolConfig({
  env = process.env,
  serverless = isVercel
} = {}) {
  const configuredMax = Number(env.DB_POOL_MAX);
  const defaultMax = serverless ? 1 : 10;
  const requestedMax =
    Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : defaultMax;

  return {
    max: serverless ? 1 : Math.max(1, requestedMax),
    connectionTimeoutMillis: Math.max(1000, Number(env.DB_CONNECTION_TIMEOUT_MS || 10000)),
    idleTimeoutMillis: Math.max(1000, Number(env.DB_IDLE_TIMEOUT_MS || (serverless ? 5000 : 30000))),
    allowExitOnIdle: serverless
  };
}

/**
 * Os dados de demonstracao criam usuarios com senha publica ("123456"), entre
 * eles administradores. Por isso, em ambiente de producao (NODE_ENV=production
 * ou Vercel) so valem com um SEGUNDO aviso explicito
 * (DEMO_SEED_ALLOW_PRODUCTION=true), pensado para a instancia de apresentacao
 * -- uma flag esquecida num servidor real nunca deve abrir um admin conhecido.
 */
/**
 * @param {Env} [env]
 * @param {boolean} [productionLike]
 */
export function shouldSeedDemoData(env = process.env, productionLike = isProductionLike) {
  const requested = isTruthyEnv(env.ENABLE_DEMO_SEED ?? env.IT_GUARDIAN_ENABLE_DEMO_SEED);
  if (!requested) return false;
  if (productionLike && !isTruthyEnv(env.DEMO_SEED_ALLOW_PRODUCTION)) return false;
  return true;
}

/**
 * @param {Env} [env]
 * @param {boolean} [productionLike]
 */
export function isDemoSeedBlockedInProduction(env = process.env, productionLike = isProductionLike) {
  const requested = isTruthyEnv(env.ENABLE_DEMO_SEED ?? env.IT_GUARDIAN_ENABLE_DEMO_SEED);
  return requested && productionLike && !isTruthyEnv(env.DEMO_SEED_ALLOW_PRODUCTION);
}

/**
 * Retencao de dados que crescem sem parar. 0 desliga a limpeza daquele grupo.
 * A trilha de auditoria da assistencia remota (hash encadeado) nunca e apagada.
 */
/**
 * auto  -> aplica esquema legado + migracoes ao subir (padrao; serverless/dev).
 * check -> nao altera nada; recusa subir se faltar migracao (deploy com `db:migrate` no pipeline).
 * skip  -> nao toca no esquema (banco gerenciado por outra ferramenta).
 */
/**
 * @param {Env} [env]
 * @returns {"auto" | "check" | "skip"}
 * @throws {Error} Para valores fora de auto/check/skip.
 */
export function getMigrationsMode(env = process.env) {
  const mode = String(env.MIGRATIONS_MODE || "auto").trim().toLowerCase();
  if (!["auto", "check", "skip"].includes(mode)) {
    throw new Error(`MIGRATIONS_MODE invalido ("${env.MIGRATIONS_MODE}"). Use auto, check ou skip.`);
  }
  return /** @type {"auto" | "check" | "skip"} */ (mode);
}

/** @param {Env} [env] */
export function getRetentionConfig(env = process.env) {
  return {
    heartbeatDays: boundedInteger(env.RETENTION_HEARTBEAT_DAYS, 30, 0, 3650),
    metricHistoryDays: boundedInteger(env.RETENTION_METRIC_HISTORY_DAYS, 90, 0, 3650),
    authSessionDays: boundedInteger(env.RETENTION_AUTH_SESSION_DAYS, 30, 1, 3650),
    reauthDays: boundedInteger(env.RETENTION_REAUTH_DAYS, 7, 1, 3650),
    reauthAttemptDays: boundedInteger(env.RETENTION_REAUTH_ATTEMPT_DAYS, 180, 0, 3650),
    auditLogDays: boundedInteger(env.RETENTION_AUDIT_LOG_DAYS, 0, 0, 3650),
    batchSize: boundedInteger(env.RETENTION_BATCH_SIZE, 5000, 100, 100000)
  };
}

/** Politicas de autenticacao/sessao, todas com limites seguros aplicados aqui. */
/** @param {Env} [env] */
export function getAuthConfig(env = process.env) {
  const idleSeconds = boundedInteger(env.SESSION_IDLE_SECONDS ?? env.SESSION_MAX_AGE_SECONDS, 8 * 3600, 300, 7 * 24 * 3600);
  const absoluteSeconds = Math.max(
    idleSeconds,
    boundedInteger(env.SESSION_ABSOLUTE_SECONDS, 12 * 3600, 600, 30 * 24 * 3600)
  );
  return {
    idleSeconds,
    absoluteSeconds,
    rotateAfterSeconds: boundedInteger(env.SESSION_ROTATE_AFTER_SECONDS, 15 * 60, 60, 24 * 3600),
    passwordHashCost: boundedInteger(env.PASSWORD_HASH_COST, 12, 10, 14),
    lockoutThreshold: boundedInteger(env.LOGIN_LOCKOUT_THRESHOLD, 5, 3, 20),
    lockoutSeconds: [60, 300, 900, 3600],
    mfaRequiredForAdmins: isTruthyEnv(env.MFA_REQUIRED_FOR_ADMINS),
    mfaTokenSeconds: 300,
    setupToken: String(env.SETUP_TOKEN || "").trim()
  };
}

export function getFrontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.CLIENT_ORIGIN) return process.env.CLIENT_ORIGIN.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5173";
}

export function getCorsOrigins() {
  const configuredOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      ...(isProductionLike ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]),
      ...configuredOrigins,
      process.env.CLIENT_ORIGIN,
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null
    ].filter(/** @returns {origin is string} */ (origin) => Boolean(origin)).map((origin) => origin.replace(/\/$/, "")))
  );
}

/**
 * Antes, qualquer origem terminando em ".vercel.app" era aceita — como esse
 * dominio e publico e compartilhado (qualquer conta pode publicar um projeto
 * ali com o nome que quiser, inclusive um nome forjado para *terminar* com o
 * nosso sufixo de time), isso permitia que um site hospedado por terceiros
 * passasse pelo CORS e pela verificacao de origem do CSRF usando cookies do
 * usuario. Nao existe padrao de sufixo/prefixo seguro nesse dominio
 * compartilhado: qualquer heuristica de string pode ser reproduzida por um
 * nome de projeto escolhido de proposito. A unica comparacao realmente
 * infalsificavel e a igualdade exata com o dominio de producao do proprio
 * projeto, que a Vercel garante ser unico globalmente e informa via
 * `VERCEL_PROJECT_PRODUCTION_URL`.
 */
/**
 * @param {string} origin
 * @param {Env} [env]
 */
export function isAllowedVercelOrigin(origin, env = process.env) {
  if (env.VERCEL !== "1") return false;

  const productionUrl = String(env.VERCEL_PROJECT_PRODUCTION_URL || "").replace(/\/$/, "");
  if (!productionUrl) return false;

  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname === productionUrl;
  } catch (_error) {
    return false;
  }
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (
    isProductionLike &&
    (!secret || secret.length < 32 || secret === "dev-secret" || secret === "change-me-in-production")
  ) {
    /** @type {Error & { statusCode?: number }} */
    const error = new Error("JWT_SECRET precisa ter pelo menos 32 caracteres aleatórios em produção.");
    error.statusCode = 500;
    throw error;
  }

  return secret || "dev-secret";
}

export function resolveDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const wantsMemory = databaseUrl === "memory" || process.env.DB_MODE === "memory";

  if (isProductionLike && wantsMemory) {
    /** @type {Error & { statusCode?: number }} */
    const error = new Error("DATABASE_URL=memory não pode ser usado em produção. Configure Supabase ou Neon.");
    error.statusCode = 500;
    throw error;
  }

  if (isProductionLike && !databaseUrl) {
    /** @type {Error & { statusCode?: number }} */
    const error = new Error("Erro ao conectar ao banco de dados. Configure DATABASE_URL no ambiente de produção.");
    error.statusCode = 500;
    throw error;
  }

  if (wantsMemory) {
    return { mode: "memory" };
  }

  const connectionString = databaseUrl || "postgres://itguardian:itguardian@localhost:5432/itguardian";
  const tls = resolveDatabaseTls({ connectionString });
  const poolConfig = resolveDatabasePoolConfig();

  return {
    mode: "postgres",
    connectionString,
    ssl: tls.ssl,
    tlsVerification: tls.verification,
    ...poolConfig
  };
}

// Provedores cujo certificado e emitido por uma CA publica: verificar o
// certificado funciona sem configurar nada.
const PUBLIC_CA_HOSTS = /neon\.tech|amazonaws\.com|azure\.com|googleapis\.com|cockroachlabs\.cloud|aivencloud\.com/i;

/**
 * Decide TLS da conexao com o banco.
 *  - DB_SSL=false           -> sem TLS (rede local/laboratorio).
 *  - DB_SSL_MODE=verify     -> TLS verificando certificado e nome do host.
 *  - DB_SSL_MODE=no-verify  -> TLS sem verificar (aceita MITM; so por escolha explicita).
 *  - DB_SSL_MODE=auto (padrao) -> verifica quando ha DB_SSL_CA (PEM no proprio
 *    valor da variavel) ou o provedor usa CA publica; caso contrario mantem
 *    TLS sem verificacao por compatibilidade e AVISA no boot/readiness.
 * `verification` e "verified" | "unverified" | "disabled" e e exposto no
 * /health/ready para o problema nao ficar invisivel.
 */
/**
 * @param {{ connectionString?: string, env?: Env, productionLike?: boolean }} [options]
 */
export function resolveDatabaseTls({ connectionString, env = process.env, productionLike = isProductionLike } = {}) {
  if (env.DB_SSL === "false") return { ssl: false, verification: "disabled" };

  const providerNeedsTls = /supabase|neon\.tech|pooler/i.test(connectionString || "");
  const wantsTls = env.DB_SSL === "true" || productionLike || providerNeedsTls;
  if (!wantsTls) return { ssl: false, verification: "disabled" };

  const ca = String(env.DB_SSL_CA || "").replace(/\\n/g, "\n").trim();
  const mode = String(env.DB_SSL_MODE || "auto").trim().toLowerCase();
  const publicCa = PUBLIC_CA_HOSTS.test(connectionString || "") && !/pooler\.supabase/i.test(connectionString || "");

  const verify = mode === "verify" || (mode === "auto" && (Boolean(ca) || publicCa));
  if (verify) {
    return {
      ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
      verification: "verified"
    };
  }
  return { ssl: { rejectUnauthorized: false }, verification: "unverified" };
}

