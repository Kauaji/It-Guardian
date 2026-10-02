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
  // RustDesk so fica disponivel com um relay proprio configurado
  // (REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER) -- nunca aponta para o relay
  // publico do RustDesk por padrao, para nao depender de infraestrutura de
  // terceiros para o trafego de tela dos clientes.
  const rustdeskIdServer = String(env.REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER || "").trim().slice(0, 200);
  const rustdeskRelayServer = String(env.REMOTE_ASSISTANCE_RUSTDESK_RELAY_SERVER || "").trim().slice(0, 200);
  const rustdeskEnabled =
    enabled &&
    isTruthyEnv(env.REMOTE_ASSISTANCE_RUSTDESK_ENABLED) &&
    Boolean(rustdeskIdServer);
  const transportRequestedRustdesk = requestedTransport === "rustdesk";
  const transport = transportRequestedRustdesk && rustdeskEnabled
    ? "rustdesk"
    : transportRequestedWebrtc && webrtcEnabled
      ? "webrtc"
      : "snapshot_polling";

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
    transportFallback:
      (transportRequestedRustdesk && !rustdeskEnabled) ||
      (transportRequestedWebrtc && !webrtcEnabled),
    webrtc: {
      enabled: webrtcEnabled,
      stunUrls: parseIceUrls(env.REMOTE_ASSISTANCE_STUN_URLS, { schemes: ["stun:", "stuns:"] }),
      hasTurn: parseIceUrls(env.REMOTE_ASSISTANCE_TURN_URL, { maxEntries: 1, schemes: ["turn:", "turns:"] }).length > 0,
      iceServers: buildIceServers(env),
      maxBitrateKbps: boundedInteger(env.REMOTE_ASSISTANCE_MAX_BITRATE_KBPS, 2500, 500, 6000)
    },
    // Transporte alternativo via cliente nativo RustDesk (self-hosted).
    // O backend nunca guarda a senha de sessao -- so o id do dispositivo
    // (publico por natureza, igual um numero de telefone) fica no card da
    // maquina. Ver docs/ASSISTENCIA-REMOTA.md, secao "Transporte RustDesk".
    rustdesk: {
      enabled: rustdeskEnabled,
      idServer: rustdeskIdServer,
      relayServer: rustdeskRelayServer,
      // Senha de sessao: gerada por sessao, nunca reaproveitada entre
      // maquinas ou entre atendimentos, expira sozinha mesmo se o comando de
      // revogacao para o agente se perder (ver assertRustdeskEnabled /
      // generateRustdeskSessionPassword em domain/remoteAssistancePolicy.js).
      passwordTtlSeconds: boundedInteger(env.REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_TTL_SECONDS, 300, 60, 900),
      passwordLength: boundedInteger(env.REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_LENGTH, 16, 12, 32)
    }
  };
}

/**
 * Lista pronta de RTCIceServer (STUN + TURN, com credenciais quando
 * configuradas) para o navegador e o agente montarem a mesma RTCConfiguration
 * sem duplicar a leitura de env vars em dois lugares. Sem
 * REMOTE_ASSISTANCE_TURN_URL configurado, a lista fica so com STUN -- valido
 * para redes sem NAT simetrico, mas sem garantia de conectividade universal
 * (isso exigiria um servidor TURN de verdade, que e infraestrutura separada,
 * fora do que o deploy serverless atual hospeda).
 */
function buildIceServers(env) {
  const servers = parseIceUrls(env.REMOTE_ASSISTANCE_STUN_URLS, { schemes: ["stun:", "stuns:"] })
    .map((urls) => ({ urls }));
  const turnUrls = parseIceUrls(env.REMOTE_ASSISTANCE_TURN_URL, { maxEntries: 1, schemes: ["turn:", "turns:"] });
  if (turnUrls.length) {
    servers.push({
      urls: turnUrls[0],
      username: String(env.REMOTE_ASSISTANCE_TURN_USERNAME || "").trim().slice(0, 200) || undefined,
      credential: String(env.REMOTE_ASSISTANCE_TURN_CREDENTIAL || "").trim().slice(0, 200) || undefined
    });
  }
  return servers;
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

/**
 * Os dados de demonstracao criam usuarios com senha publica ("123456"), entre
 * eles administradores. Por isso, em ambiente de producao (NODE_ENV=production
 * ou Vercel) so valem com um SEGUNDO aviso explicito
 * (DEMO_SEED_ALLOW_PRODUCTION=true), pensado para a instancia de apresentacao
 * -- uma flag esquecida num servidor real nunca deve abrir um admin conhecido.
 */
export function shouldSeedDemoData(env = process.env, productionLike = isProductionLike) {
  const requested = isTruthyEnv(env.ENABLE_DEMO_SEED ?? env.IT_GUARDIAN_ENABLE_DEMO_SEED);
  if (!requested) return false;
  if (productionLike && !isTruthyEnv(env.DEMO_SEED_ALLOW_PRODUCTION)) return false;
  return true;
}

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
export function getMigrationsMode(env = process.env) {
  const mode = String(env.MIGRATIONS_MODE || "auto").trim().toLowerCase();
  if (!["auto", "check", "skip"].includes(mode)) {
    throw new Error(`MIGRATIONS_MODE invalido ("${env.MIGRATIONS_MODE}"). Use auto, check ou skip.`);
  }
  return mode;
}

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

