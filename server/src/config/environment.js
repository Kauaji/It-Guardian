import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

export const isVercel = process.env.VERCEL === "1";
export const vercelEnv = process.env.VERCEL_ENV || "";
export const isProduction = process.env.NODE_ENV === "production";
export const isProductionLike = isProduction || isVercel;

function isTruthyEnv(value) {
  return ["1", "true", "yes", "sim"].includes(String(value || "").trim().toLowerCase());
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function getRemoteAssistanceConfig(env = process.env) {
  const environment = String(
    env.REMOTE_ASSISTANCE_ENV ||
      env.REMOTE_ASSISTANCE_ENVIRONMENT ||
      env.IT_GUARDIAN_ENVIRONMENT ||
      env.NODE_ENV ||
      "disabled"
  ).trim().toLowerCase();
  const allowedEnvironments = new Set([
    "lab",
    "laboratory",
    "laboratorio",
    "homologation",
    "homologacao",
    "internal",
    "interno",
    "test"
  ]);
  const publicDeployment = env.VERCEL === "1" || env.VERCEL_ENV === "production";
  const environmentAllowed = allowedEnvironments.has(environment);
  const enabled = isTruthyEnv(env.ENABLE_REMOTE_ASSISTANCE) && environmentAllowed;
  const controlEnabled = enabled && isTruthyEnv(
    env.ENABLE_REMOTE_CONTROL ?? env.ENABLE_REMOTE_ASSISTANCE_CONTROL
  );

  return {
    enabled,
    environment,
    publicDeployment,
    disabledReason: enabled
      ? null
      : !environmentAllowed
          ? "environment_not_allowed"
          : "feature_disabled",
    captureEnabled: enabled,
    controlEnabled,
    privacyModeEnabled: enabled && isTruthyEnv(env.ENABLE_REMOTE_PRIVACY_MODE),
    adminActionsEnabled: enabled && isTruthyEnv(env.ENABLE_REMOTE_ADMIN_ACTIONS),
    autoConsentEnabled:
      enabled &&
      !publicDeployment &&
      isTruthyEnv(
        env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT ??
          env.ENABLE_REMOTE_ASSISTANCE_AUTO_CONSENT
      ),
    sessionTtlMinutes: boundedInteger(env.REMOTE_ASSISTANCE_SESSION_TTL_MINUTES, 20, 5, 60),
    reauthTtlMinutes: 5,
    maxFrameBytes: boundedInteger(env.REMOTE_ASSISTANCE_MAX_FRAME_BYTES, 700000, 100000, 900000),
    maxFramesPerSecond: boundedInteger(env.REMOTE_ASSISTANCE_MAX_FPS, 1, 1, 1),
    maxQueuedCommands: boundedInteger(env.REMOTE_ASSISTANCE_MAX_QUEUED_COMMANDS, 100, 10, 250),
    agentTimeoutSeconds: boundedInteger(env.REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS, 45, 15, 300)
  };
}

export function isRemoteScriptExecutionEnabled(env = process.env) {
  return isTruthyEnv(env.ENABLE_REMOTE_SCRIPT_EXECUTION);
}

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

export function shouldSeedDemoData() {
  const flag = process.env.ENABLE_DEMO_SEED ?? process.env.IT_GUARDIAN_ENABLE_DEMO_SEED;
  return isTruthyEnv(flag);
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
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...configuredOrigins,
      process.env.CLIENT_ORIGIN,
      process.env.FRONTEND_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null
    ].filter(Boolean).map((origin) => origin.replace(/\/$/, "")))
  );
}

export function isAllowedVercelOrigin(origin) {
  try {
    const url = new URL(origin);
    return isVercel && url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
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
    const error = new Error("DATABASE_URL=memory não pode ser usado em produção. Configure Supabase ou Neon.");
    error.statusCode = 500;
    throw error;
  }

  if (isProductionLike && !databaseUrl) {
    const error = new Error("Erro ao conectar ao banco de dados. Configure DATABASE_URL no ambiente de produção.");
    error.statusCode = 500;
    throw error;
  }

  if (wantsMemory) {
    return { mode: "memory" };
  }

  const connectionString = databaseUrl || "postgres://itguardian:itguardian@localhost:5432/itguardian";
  const shouldUseSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSL !== "false" &&
      (isProductionLike || /supabase|neon\.tech|pooler/i.test(connectionString)));
  const poolConfig = resolveDatabasePoolConfig();

  return {
    mode: "postgres",
    connectionString,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    ...poolConfig
  };
}

