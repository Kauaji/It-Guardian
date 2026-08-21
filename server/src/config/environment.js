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

function isTruthyEnvWithDefault(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === "") return defaultValue;
  return isTruthyEnv(value);
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function parseIceUrls(value, { maxEntries = 4, maxLength = 200, schemes } = {}) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.length <= maxLength)
    .filter((entry) => schemes.some((scheme) => entry.toLowerCase().startsWith(scheme)))
    .slice(0, maxEntries);
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
  // Pausa de seguranca temporaria (2026-08-14 a 2026-08-15): auditoria
  // encontrou que o ACL do pipe nomeado local do agente Windows aceitava
  // qualquer usuario autenticado da maquina (nao so o usuario logado),
  // permitindo interferir no consentimento sem o dono da tela saber.
  // Corrigido no agente (pipe restrito a WellKnownSidType.InteractiveSid,
  // commit 9c4e06f) e confirmado em uso apos reinstalacao do coletor —
  // reativado. Maquinas que ainda rodam um agente anterior a esse commit
  // continuam com o pipe antigo ate serem reinstaladas com o instalador
  // atual; assistencia remota so e de fato segura na maquina especifica que
  // ja recebeu o agente corrigido.
  const enabled = isTruthyEnv(env.ENABLE_REMOTE_ASSISTANCE) && environmentAllowed;
  const controlEnabled = enabled && isTruthyEnv(
    env.ENABLE_REMOTE_CONTROL ?? env.ENABLE_REMOTE_ASSISTANCE_CONTROL
  );

  // Limite rigido de FPS: nunca aceitar quadros mais rapido do que o servidor
  // consegue validar/descartar com seguranca. targetFps e o valor "desejado"
  // repassado ao agente, sempre limitado pelo teto de maxFramesPerSecond.
  // Teto e padrao elevados de 5/3 para 10/8 para reduzir o atraso percebido
  // na transmissao -- ainda um limite deliberado (nao virou video real via
  // WebRTC, continua snapshot JPEG por polling HTTP), so mais generoso do
  // que o valor conservador original.
  const maxFramesPerSecond = boundedInteger(env.REMOTE_ASSISTANCE_MAX_FPS, 8, 1, 10);
  const targetFps = Math.min(
    maxFramesPerSecond,
    boundedInteger(env.REMOTE_ASSISTANCE_TARGET_FPS, maxFramesPerSecond, 1, 10)
  );
  const minJpegQuality = boundedInteger(env.REMOTE_ASSISTANCE_MIN_JPEG_QUALITY, 35, 10, 90);
  const maxJpegQuality = Math.max(
    minJpegQuality,
    boundedInteger(env.REMOTE_ASSISTANCE_MAX_JPEG_QUALITY, 80, 20, 95)
  );
  const jpegQuality = Math.min(
    maxJpegQuality,
    Math.max(minJpegQuality, boundedInteger(env.REMOTE_ASSISTANCE_JPEG_QUALITY, 65, 10, 95))
  );
  const agentTimeoutSeconds = boundedInteger(env.REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS, 45, 15, 300);
  const idleTimeoutSeconds = Math.min(
    boundedInteger(env.REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS, 60, 20, 300),
    Math.max(10, agentTimeoutSeconds - 5)
  );
  const serverMinFrameIntervalMs = Math.ceil(1000 / maxFramesPerSecond);
  const agentCaptureMs = Math.max(
    serverMinFrameIntervalMs,
    boundedInteger(
      env.REMOTE_ASSISTANCE_AGENT_CAPTURE_MS,
      Math.ceil(1000 / targetFps),
      150,
      2000
    )
  );
  // Piso reduzido de 150 para 80ms: com o novo teto de FPS, agentCaptureMs
  // pode ficar em 100-125ms; um piso de 150 aqui viraria o novo gargalo,
  // fazendo o visualizador esperar mais do que o agente realmente captura.
  const viewerPollMs = Math.max(
    80,
    boundedInteger(env.REMOTE_ASSISTANCE_VIEWER_POLL_MS, agentCaptureMs, 80, 2000)
  );

  const requestedTransport = String(env.REMOTE_ASSISTANCE_TRANSPORT || "snapshot_polling")
    .trim()
    .toLowerCase();
  const webrtcEnabled = enabled && isTruthyEnv(env.REMOTE_ASSISTANCE_WEBRTC_ENABLED);
  const transportRequestedWebrtc = requestedTransport === "webrtc";
  const transport = transportRequestedWebrtc && webrtcEnabled ? "webrtc" : "snapshot_polling";

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
    maxFramesPerSecond,
    targetFps,
    maxWidth: boundedInteger(env.REMOTE_ASSISTANCE_MAX_WIDTH, 1280, 320, 1920),
    maxHeight: boundedInteger(env.REMOTE_ASSISTANCE_MAX_HEIGHT, 720, 240, 1080),
    jpegQuality,
    minJpegQuality,
    maxJpegQuality,
    adaptiveQuality: isTruthyEnvWithDefault(env.REMOTE_ASSISTANCE_ADAPTIVE_QUALITY, true),
    agentCaptureMs,
    viewerPollMs,
    idleTimeoutSeconds,
    reconnectGraceSeconds: boundedInteger(env.REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS, 30, 10, 120),
    maxQueuedCommands: boundedInteger(env.REMOTE_ASSISTANCE_MAX_QUEUED_COMMANDS, 100, 10, 250),
    agentTimeoutSeconds,
    transport,
    transportFallback: transportRequestedWebrtc && !webrtcEnabled,
    webrtc: {
      enabled: webrtcEnabled,
      stunUrls: parseIceUrls(env.REMOTE_ASSISTANCE_STUN_URLS, { schemes: ["stun:", "stuns:"] }),
      hasTurn: parseIceUrls(env.REMOTE_ASSISTANCE_TURN_URL, { maxEntries: 1, schemes: ["turn:", "turns:"] }).length > 0,
      maxBitrateKbps: boundedInteger(env.REMOTE_ASSISTANCE_MAX_BITRATE_KBPS, 2500, 500, 6000)
    }
  };
}

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

