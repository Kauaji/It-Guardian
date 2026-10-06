/**
 * Limites de captura que a politica de qualidade le. O formato vem de
 * `getRemoteAssistanceConfig` (config/remoteAssistanceConfig.js), mas o dominio e puro e
 * nao pode importar a configuracao (le variaveis de ambiente): ele declara so o que usa.
 * @typedef {object} RemoteAssistanceCaptureConfig
 * @property {number} minJpegQuality
 * @property {number} maxJpegQuality
 * @property {number} maxWidth
 * @property {number} maxHeight
 * @property {number} jpegQuality
 * @property {boolean} adaptiveQuality
 * @property {number} maxFrameBytes
 */
/** @typedef {{ enabled?: boolean, webrtc?: { enabled?: boolean }, rustdesk?: { enabled?: boolean, passwordLength?: number }, controlEnabled?: boolean }} RemoteAssistanceFlags Subconjunto da configuracao que as regras leem. */

const activeStatuses = new Set(["requested", "waiting_consent", "connecting", "active"]);

/**
 * @param {RemoteAssistanceFlags | null | undefined} config
 * @throws {import("../lib/errors.js").HttpErrorLike} 403 quando a assistencia remota esta desativada.
 */
export function assertRemoteAssistanceEnabled(config) {
  if (config?.enabled) return;
  /** @type {import("../lib/errors.js").HttpErrorLike} */
  const error = new Error("A assistencia remota esta desativada ou indisponivel neste ambiente.");
  error.statusCode = 403;
  error.expose = true;
  throw error;
}

/**
 * O transporte WebRTC fica inativo ate REMOTE_ASSISTANCE_WEBRTC_ENABLED=true
 * (teto de FPS/latencia do snapshot polling continua sendo o padrao seguro).
 */
/** @param {RemoteAssistanceFlags | null | undefined} config */
export function assertWebrtcEnabled(config) {
  assertRemoteAssistanceEnabled(config);
  if (config?.webrtc?.enabled) return;
  /** @type {import("../lib/errors.js").HttpErrorLike} */
  const error = new Error("O transporte WebRTC nao esta habilitado neste ambiente.");
  error.statusCode = 409;
  error.expose = true;
  throw error;
}

/**
 * Transporte RustDesk fica inativo ate REMOTE_ASSISTANCE_RUSTDESK_ENABLED=true
 * com um relay proprio configurado (nunca cai no relay publico do RustDesk).
 */
/** @param {RemoteAssistanceFlags | null | undefined} config */
export function assertRustdeskEnabled(config) {
  assertRemoteAssistanceEnabled(config);
  if (config?.rustdesk?.enabled) return;
  /** @type {import("../lib/errors.js").HttpErrorLike} */
  const error = new Error("O transporte RustDesk nao esta habilitado neste ambiente.");
  error.statusCode = 409;
  error.expose = true;
  throw error;
}

const RUSTDESK_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Senha de sessao do RustDesk: gerada por sessao (nunca fixa, nunca
 * compartilhada entre maquinas), fora do alfabeto de caracteres ambiguos
 * (0/O, 1/l/I) para reduzir erro de digitacao no lado do tecnico -- o valor
 * so e digitado manualmente no cliente RustDesk, nunca via URL (evita
 * vazamento por historico de navegador/logs de sistema operacional).
 *
 * @param {RemoteAssistanceFlags | null | undefined} config
 * @param {(size: number) => Uint8Array} randomBytes Fonte de bytes aleatorios (injetavel para teste).
 * @returns {string}
 */
export function generateRustdeskSessionPassword(config, randomBytes) {
  const length = config?.rustdesk?.passwordLength || 16;
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += RUSTDESK_PASSWORD_ALPHABET[bytes[i] % RUSTDESK_PASSWORD_ALPHABET.length];
  }
  return password;
}

const MAX_SDP_LENGTH = 20000;

/**
 * Validacao minima de forma (tamanho e prefixo de versao SDP), nao semantica.
 * SDP exige toda linha terminada em CRLF, inclusive a ultima; trim() acima
 * remove justamente esse terminador final, e um parser mais rigoroso (o do
 * Chrome, por exemplo) rejeita o SDP inteiro por causa disso -- confirmado
 * testando uma negociacao real de ponta a ponta -- entao ele e sempre
 * reposto antes de devolver.
 *
 * @param {unknown} value
 * @returns {string | null} SDP aparado e terminado em CRLF, ou null se invalido.
 */
export function sanitizeSdp(value) {
  const sdp = String(value || "").trim();
  if (!sdp || sdp.length > MAX_SDP_LENGTH) return null;
  if (!sdp.startsWith("v=0")) return null;
  return sdp + "\r\n";
}

/**
 * @param {unknown} value
 * @param {RemoteAssistanceFlags | null | undefined} config
 * @param {boolean} canControl O usuario tem a permissao de controle.
 * @returns {"view" | "control"}
 * @throws {import("../lib/errors.js").HttpErrorLike} 400 modo invalido; 403 controle nao autorizado.
 */
export function normalizeRequestedMode(value, config, canControl) {
  const mode = String(value || "view").trim().toLowerCase();
  if (!new Set(["view", "control"]).has(mode)) {
    /** @type {import("../lib/errors.js").HttpErrorLike} */
    const error = new Error("Modo de assistencia remota invalido.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
  if (mode === "control" && (!config?.controlEnabled || !canControl)) {
    /** @type {import("../lib/errors.js").HttpErrorLike} */
    const error = new Error("Controle remoto nao autorizado para este usuario ou ambiente.");
    error.statusCode = 403;
    error.expose = true;
    throw error;
  }
  return /** @type {"view" | "control"} */ (mode);
}

/**
 * @typedef {object} RemoteSessionLike
 * @property {string} [status]
 * @property {string} [requestedMode]
 * @property {boolean} [remoteControlEnabled]
 * @property {boolean} [controlConsentGranted]
 * @property {string} [consentStatus]
 */

/**
 * @param {{ session?: RemoteSessionLike | null, config?: RemoteAssistanceFlags | null, canControl: boolean }} input
 * @returns {boolean}
 */
export function canRelayInput({ session, config, canControl }) {
  return Boolean(
    session &&
      session.status === "active" &&
      session.requestedMode === "control" &&
      session.remoteControlEnabled &&
      session.controlConsentGranted &&
      session.consentStatus === "granted" &&
      config?.controlEnabled &&
      canControl
  );
}

/** @param {string | undefined} status */
export function isSessionActive(status) {
  return activeStatuses.has(/** @type {string} */ (status));
}

/**
 * @param {{ lastSeenAt?: string | Date | null, intervalSeconds?: number | string | null } | null | undefined} asset
 * @param {number} [now]
 * @returns {boolean}
 */
export function isAgentFresh(asset, now = Date.now()) {
  if (!asset?.lastSeenAt) return false;
  const intervalMs = Math.max(30, Number(asset.intervalSeconds || 300)) * 1000;
  const freshnessWindow = Math.max(3 * intervalMs, 10 * 60 * 1000);
  return now - new Date(asset.lastSeenAt).getTime() <= freshnessWindow;
}

const derivedTerminalOrOwnStatuses = new Set([
  "waiting_consent",
  "consent_denied",
  "ended",
  "expired",
  "failed"
]);

/**
 * Estado de conexao exibivel no viewer, derivado sem persistir nada novo:
 * combina o status oficial da sessao com o tempo desde o ultimo frame do
 * relay efemero (nunca o conteudo do frame).
 *
 * @param {{ session?: RemoteSessionLike | null, relay?: { framesTotal?: number, lastFrameAt?: number } | null, config?: { idleTimeoutSeconds?: number, agentTimeoutSeconds?: number } | null, now?: number }} input
 * @returns {string}
 */
export function deriveConnectionState({ session, relay, config, now = Date.now() }) {
  if (!session) return "unknown";
  if (derivedTerminalOrOwnStatuses.has(String(session.status))) return /** @type {string} */ (session.status);
  if (session.status !== "active") return session.status || "unknown";

  const framesReceived = Number(relay?.framesTotal || 0) > 0;
  const lastActivityAt = Number(relay?.lastFrameAt || 0);
  if (!framesReceived || !lastActivityAt) return "connecting";

  const ageMs = Math.max(0, now - lastActivityAt);
  const idleMs = Math.max(1000, Number(config?.idleTimeoutSeconds || 60) * 1000);
  const timeoutMs = Math.max(idleMs + 1000, Number(config?.agentTimeoutSeconds || 45) * 1000);
  if (ageMs >= timeoutMs) return "agent_offline";
  if (ageMs >= idleMs) return "reconnecting";
  return "active";
}

/**
 * Passo unico do controlador adaptativo de qualidade: reage ao tamanho do
 * ultimo frame aceito, nunca a latencia de rede real (que o transporte de
 * snapshot HTTP nao mede com precisao). Reduz rapido perto do limite,
 * recupera qualidade aos poucos quando a conexao esta folgada.
 *
 * @param {object} input
 * @param {number} input.quality JPEG atual (0-100).
 * @param {number} input.width
 * @param {number} input.height
 * @param {number} input.lastFrameBytes
 * @param {RemoteAssistanceCaptureConfig} input.config
 * @returns {{ quality: number, width: number, height: number, changed: boolean }}
 */
export function stepAdaptiveQuality({ quality, width, height, lastFrameBytes, config }) {
  const minQuality = config.minJpegQuality;
  const maxQuality = config.maxJpegQuality;
  const maxWidth = config.maxWidth;
  const maxHeight = config.maxHeight;
  const minWidth = Math.max(480, Math.round(maxWidth * 0.5));
  const minHeight = Math.max(270, Math.round(maxHeight * 0.5));
  const currentQuality = Number.isFinite(quality) ? quality : config.jpegQuality;
  const currentWidth = Number.isFinite(width) ? width : maxWidth;
  const currentHeight = Number.isFinite(height) ? height : maxHeight;

  if (!config.adaptiveQuality || !Number.isFinite(lastFrameBytes) || lastFrameBytes <= 0) {
    return { quality: currentQuality, width: currentWidth, height: currentHeight, changed: false };
  }

  const heavyRatio = lastFrameBytes / config.maxFrameBytes;
  let quality2 = currentQuality;
  let width2 = currentWidth;
  let height2 = currentHeight;

  if (heavyRatio >= 0.85) {
    quality2 = Math.max(minQuality, currentQuality - 8);
    if (quality2 === minQuality && heavyRatio >= 0.95) {
      width2 = Math.max(minWidth, Math.round(currentWidth * 0.85));
      height2 = Math.max(minHeight, Math.round(currentHeight * 0.85));
    }
  } else if (heavyRatio <= 0.4) {
    if (currentWidth < maxWidth || currentHeight < maxHeight) {
      width2 = Math.min(maxWidth, currentWidth + Math.round(maxWidth * 0.1));
      height2 = Math.min(maxHeight, currentHeight + Math.round(maxHeight * 0.1));
    } else {
      quality2 = Math.min(maxQuality, currentQuality + 3);
    }
  }

  const changed = quality2 !== currentQuality || width2 !== currentWidth || height2 !== currentHeight;
  return { quality: quality2, width: width2, height: height2, changed };
}
