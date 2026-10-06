import { boundedInteger, isTruthyEnv, isTruthyEnvWithDefault, parseIceUrls } from "./envParsing.js";

/** @import { Env } from "./envParsing.js" */

/**
 * @typedef {object} IceServer
 * @property {string} urls
 * @property {string} [username]
 * @property {string} [credential]
 */

const allowedEnvironments = new Set(["lab", "laboratory", "laboratorio", "homologation", "homologacao", "internal", "interno", "test"]);

// Ambiente e flags principais: a assistencia so liga com a flag explicita E em
// um ambiente da lista permitida.
/** @param {Env} env */
function resolveActivation(env) {
  const environment = String(
    env.REMOTE_ASSISTANCE_ENV || env.REMOTE_ASSISTANCE_ENVIRONMENT || env.IT_GUARDIAN_ENVIRONMENT || env.NODE_ENV || "disabled"
  )
    .trim()
    .toLowerCase();
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
  const controlEnabled = enabled && isTruthyEnv(env.ENABLE_REMOTE_CONTROL ?? env.ENABLE_REMOTE_ASSISTANCE_CONTROL);

  return { environment, publicDeployment, environmentAllowed, enabled, controlEnabled };
}

// Limites de captura (FPS, qualidade JPEG), tempos limite e intervalos de polling.
/** @param {Env} env */
function resolveCaptureLimits(env) {
  // Limite rigido de FPS: nunca aceitar quadros mais rapido do que o servidor
  // consegue validar/descartar com seguranca. targetFps e o valor "desejado"
  // repassado ao agente, sempre limitado pelo teto de maxFramesPerSecond.
  // Teto e padrao elevados de 5/3 para 10/8 para reduzir o atraso percebido
  // na transmissao -- ainda um limite deliberado (nao virou video real via
  // WebRTC, continua snapshot JPEG por polling HTTP), so mais generoso do
  // que o valor conservador original.
  const maxFramesPerSecond = boundedInteger(env.REMOTE_ASSISTANCE_MAX_FPS, 8, 1, 10);
  const targetFps = Math.min(maxFramesPerSecond, boundedInteger(env.REMOTE_ASSISTANCE_TARGET_FPS, maxFramesPerSecond, 1, 10));
  const minJpegQuality = boundedInteger(env.REMOTE_ASSISTANCE_MIN_JPEG_QUALITY, 35, 10, 90);
  const maxJpegQuality = Math.max(minJpegQuality, boundedInteger(env.REMOTE_ASSISTANCE_MAX_JPEG_QUALITY, 80, 20, 95));
  const jpegQuality = Math.min(maxJpegQuality, Math.max(minJpegQuality, boundedInteger(env.REMOTE_ASSISTANCE_JPEG_QUALITY, 65, 10, 95)));
  const agentTimeoutSeconds = boundedInteger(env.REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS, 45, 15, 300);
  const idleTimeoutSeconds = Math.min(
    boundedInteger(env.REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS, 60, 20, 300),
    Math.max(10, agentTimeoutSeconds - 5)
  );
  const serverMinFrameIntervalMs = Math.ceil(1000 / maxFramesPerSecond);
  const agentCaptureMs = Math.max(
    serverMinFrameIntervalMs,
    boundedInteger(env.REMOTE_ASSISTANCE_AGENT_CAPTURE_MS, Math.ceil(1000 / targetFps), 150, 2000)
  );
  // Piso reduzido de 150 para 80ms: com o novo teto de FPS, agentCaptureMs
  // pode ficar em 100-125ms; um piso de 150 aqui viraria o novo gargalo,
  // fazendo o visualizador esperar mais do que o agente realmente captura.
  const viewerPollMs = Math.max(80, boundedInteger(env.REMOTE_ASSISTANCE_VIEWER_POLL_MS, agentCaptureMs, 80, 2000));

  return {
    maxFramesPerSecond,
    targetFps,
    minJpegQuality,
    maxJpegQuality,
    jpegQuality,
    agentTimeoutSeconds,
    idleTimeoutSeconds,
    agentCaptureMs,
    viewerPollMs
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
 * @param {Env} env
 * @returns {IceServer[]}
 */
function buildIceServers(env) {
  /** @type {IceServer[]} */
  const servers = parseIceUrls(env.REMOTE_ASSISTANCE_STUN_URLS, { schemes: ["stun:", "stuns:"] }).map((urls) => ({ urls }));
  const turnUrls = parseIceUrls(env.REMOTE_ASSISTANCE_TURN_URL, { maxEntries: 1, schemes: ["turn:", "turns:"] });
  if (turnUrls.length) {
    servers.push({
      urls: turnUrls[0],
      username:
        String(env.REMOTE_ASSISTANCE_TURN_USERNAME || "")
          .trim()
          .slice(0, 200) || undefined,
      credential:
        String(env.REMOTE_ASSISTANCE_TURN_CREDENTIAL || "")
          .trim()
          .slice(0, 200) || undefined
    });
  }
  return servers;
}

/**
 * @param {Env} env
 * @param {boolean} enabled
 */
function resolveWebrtc(env, enabled) {
  return {
    enabled: enabled && isTruthyEnv(env.REMOTE_ASSISTANCE_WEBRTC_ENABLED),
    stunUrls: parseIceUrls(env.REMOTE_ASSISTANCE_STUN_URLS, { schemes: ["stun:", "stuns:"] }),
    hasTurn: parseIceUrls(env.REMOTE_ASSISTANCE_TURN_URL, { maxEntries: 1, schemes: ["turn:", "turns:"] }).length > 0,
    iceServers: buildIceServers(env),
    maxBitrateKbps: boundedInteger(env.REMOTE_ASSISTANCE_MAX_BITRATE_KBPS, 2500, 500, 6000)
  };
}

// Transporte alternativo via cliente nativo RustDesk (self-hosted).
// O backend nunca guarda a senha de sessao -- so o id do dispositivo
// (publico por natureza, igual um numero de telefone) fica no card da
// maquina. Ver docs/ASSISTENCIA-REMOTA.md, secao "Transporte RustDesk".
/**
 * @param {Env} env
 * @param {boolean} enabled
 */
function resolveRustdesk(env, enabled) {
  // RustDesk so fica disponivel com um relay proprio configurado
  // (REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER) -- nunca aponta para o relay
  // publico do RustDesk por padrao, para nao depender de infraestrutura de
  // terceiros para o trafego de tela dos clientes.
  const idServer = String(env.REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER || "")
    .trim()
    .slice(0, 200);
  const relayServer = String(env.REMOTE_ASSISTANCE_RUSTDESK_RELAY_SERVER || "")
    .trim()
    .slice(0, 200);
  return {
    enabled: enabled && isTruthyEnv(env.REMOTE_ASSISTANCE_RUSTDESK_ENABLED) && Boolean(idServer),
    idServer,
    relayServer,
    // Senha de sessao: gerada por sessao, nunca reaproveitada entre
    // maquinas ou entre atendimentos, expira sozinha mesmo se o comando de
    // revogacao para o agente se perder (ver assertRustdeskEnabled /
    // generateRustdeskSessionPassword em domain/remoteAssistancePolicy.js).
    passwordTtlSeconds: boundedInteger(env.REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_TTL_SECONDS, 300, 60, 900),
    passwordLength: boundedInteger(env.REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_LENGTH, 16, 12, 32)
  };
}

// Transporte efetivo: o pedido so vale quando o recurso correspondente esta
// habilitado; caso contrario cai no snapshot por polling HTTP.
/**
 * @param {Env} env
 * @param {{ enabled: boolean }} webrtc
 * @param {{ enabled: boolean }} rustdesk
 */
function resolveTransport(env, webrtc, rustdesk) {
  const requestedTransport = String(env.REMOTE_ASSISTANCE_TRANSPORT || "snapshot_polling")
    .trim()
    .toLowerCase();
  const requestedWebrtc = requestedTransport === "webrtc";
  const requestedRustdesk = requestedTransport === "rustdesk";
  const transport = requestedRustdesk && rustdesk.enabled ? "rustdesk" : requestedWebrtc && webrtc.enabled ? "webrtc" : "snapshot_polling";

  return {
    transport,
    transportFallback: (requestedRustdesk && !rustdesk.enabled) || (requestedWebrtc && !webrtc.enabled)
  };
}

/** @param {Env} [env] */
export function getRemoteAssistanceConfig(env = process.env) {
  const { environment, publicDeployment, environmentAllowed, enabled, controlEnabled } = resolveActivation(env);
  const capture = resolveCaptureLimits(env);
  const webrtc = resolveWebrtc(env, enabled);
  const rustdesk = resolveRustdesk(env, enabled);
  const { transport, transportFallback } = resolveTransport(env, webrtc, rustdesk);

  return {
    enabled,
    environment,
    publicDeployment,
    disabledReason: enabled ? null : !environmentAllowed ? "environment_not_allowed" : "feature_disabled",
    captureEnabled: enabled,
    controlEnabled,
    privacyModeEnabled: enabled && isTruthyEnv(env.ENABLE_REMOTE_PRIVACY_MODE),
    adminActionsEnabled: enabled && isTruthyEnv(env.ENABLE_REMOTE_ADMIN_ACTIONS),
    autoConsentEnabled:
      enabled && !publicDeployment && isTruthyEnv(env.REMOTE_ASSISTANCE_LAB_AUTO_CONSENT ?? env.ENABLE_REMOTE_ASSISTANCE_AUTO_CONSENT),
    sessionTtlMinutes: boundedInteger(env.REMOTE_ASSISTANCE_SESSION_TTL_MINUTES, 20, 5, 60),
    reauthTtlMinutes: 5,
    maxFrameBytes: boundedInteger(env.REMOTE_ASSISTANCE_MAX_FRAME_BYTES, 700000, 100000, 900000),
    maxFramesPerSecond: capture.maxFramesPerSecond,
    targetFps: capture.targetFps,
    maxWidth: boundedInteger(env.REMOTE_ASSISTANCE_MAX_WIDTH, 1280, 320, 1920),
    maxHeight: boundedInteger(env.REMOTE_ASSISTANCE_MAX_HEIGHT, 720, 240, 1080),
    jpegQuality: capture.jpegQuality,
    minJpegQuality: capture.minJpegQuality,
    maxJpegQuality: capture.maxJpegQuality,
    adaptiveQuality: isTruthyEnvWithDefault(env.REMOTE_ASSISTANCE_ADAPTIVE_QUALITY, true),
    agentCaptureMs: capture.agentCaptureMs,
    viewerPollMs: capture.viewerPollMs,
    idleTimeoutSeconds: capture.idleTimeoutSeconds,
    reconnectGraceSeconds: boundedInteger(env.REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS, 30, 10, 120),
    maxQueuedCommands: boundedInteger(env.REMOTE_ASSISTANCE_MAX_QUEUED_COMMANDS, 100, 10, 250),
    agentTimeoutSeconds: capture.agentTimeoutSeconds,
    transport,
    transportFallback,
    webrtc,
    rustdesk
  };
}
