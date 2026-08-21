import assert from "node:assert/strict";
import test from "node:test";

import { getRemoteAssistanceConfig } from "../config/environment.js";
import {
  assertRemoteAssistanceEnabled,
  canRelayInput,
  deriveConnectionState,
  isAgentFresh,
  isSessionActive,
  normalizeRequestedMode,
  sanitizeSdp,
  stepAdaptiveQuality
} from "./remoteAssistancePolicy.js";
import {
  canShowRemoteAssistanceAction,
  formatBytesPerSecond,
  formatFrameSize,
  formatRemoteMonitor,
  hasRemoteAssistanceAgent,
  isRemoteAssistanceAssetFresh,
  isRemoteAssistanceFrameStale,
  remoteAssistanceStatusLabel,
  remoteAssistanceTransportLabel
} from "../../../client/src/components/remoteAssistance/remoteAssistanceModel.js";

test("assistencia remota permanece desativada por padrao", () => {
  const config = getRemoteAssistanceConfig({ NODE_ENV: "production" });

  assert.equal(config.enabled, false);
  assert.equal(config.controlEnabled, false);
  assert.equal(config.privacyModeEnabled, false);
  assert.equal(config.adminActionsEnabled, false);
  assert.equal(config.autoConsentEnabled, false);
  assert.throws(() => assertRemoteAssistanceEnabled(config), /desativada/i);
});

test("modo laboratorio habilita captura e limita o teto de FPS a um valor seguro", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    ENABLE_REMOTE_CONTROL: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MAX_FPS: "9"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.captureEnabled, true);
  assert.equal(config.controlEnabled, true);
  assert.equal(config.maxFramesPerSecond, 9);
  assert.equal(config.privacyModeEnabled, false);
  assert.equal(config.adminActionsEnabled, false);
});

test("FPS alvo nunca ultrapassa o teto configurado e permanece dentro do limite seguro", () => {
  const belowCeiling = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MAX_FPS: "3",
    REMOTE_ASSISTANCE_TARGET_FPS: "10"
  });
  assert.equal(belowCeiling.maxFramesPerSecond, 3);
  assert.equal(belowCeiling.targetFps, 3);

  const defaultTarget = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab"
  });
  assert.equal(defaultTarget.maxFramesPerSecond, 8);
  assert.equal(defaultTarget.targetFps, 8);

  const absurd = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MAX_FPS: "999",
    REMOTE_ASSISTANCE_TARGET_FPS: "-5"
  });
  assert.equal(absurd.maxFramesPerSecond, 10);
  assert.ok(absurd.targetFps >= 1 && absurd.targetFps <= 10);
});

test("qualidade JPEG adaptativa permanece dentro dos limites configurados", () => {
  const inverted = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MIN_JPEG_QUALITY: "80",
    REMOTE_ASSISTANCE_MAX_JPEG_QUALITY: "35",
    REMOTE_ASSISTANCE_JPEG_QUALITY: "10"
  });
  assert.ok(inverted.maxJpegQuality >= inverted.minJpegQuality);
  assert.ok(inverted.jpegQuality >= inverted.minJpegQuality);
  assert.ok(inverted.jpegQuality <= inverted.maxJpegQuality);

  const defaults = getRemoteAssistanceConfig({ ENABLE_REMOTE_ASSISTANCE: "true", REMOTE_ASSISTANCE_ENV: "lab" });
  assert.equal(defaults.adaptiveQuality, true);
  assert.equal(defaults.minJpegQuality, 35);
  assert.equal(defaults.maxJpegQuality, 80);
  assert.equal(defaults.jpegQuality, 65);

  const disabledAdaptive = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_ADAPTIVE_QUALITY: "false"
  });
  assert.equal(disabledAdaptive.adaptiveQuality, false);
});

test("intervalo de captura do agente nunca fica abaixo do que o servidor aceita", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MAX_FPS: "5",
    REMOTE_ASSISTANCE_AGENT_CAPTURE_MS: "10"
  });
  assert.ok(config.agentCaptureMs >= Math.ceil(1000 / config.maxFramesPerSecond));
  assert.ok(config.viewerPollMs >= 80);
});

test("prazo de inatividade permanece sempre menor que o timeout de agente", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS: "20",
    REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS: "300"
  });
  assert.ok(config.idleTimeoutSeconds < config.agentTimeoutSeconds);
});

test("transporte WebRTC cai para snapshot polling quando a flag esta desligada", () => {
  const requestedButDisabled = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_TRANSPORT: "webrtc"
  });
  assert.equal(requestedButDisabled.transport, "snapshot_polling");
  assert.equal(requestedButDisabled.transportFallback, true);
  assert.equal(requestedButDisabled.webrtc.enabled, false);

  const explicitlyEnabled = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_TRANSPORT: "webrtc",
    REMOTE_ASSISTANCE_WEBRTC_ENABLED: "true"
  });
  assert.equal(explicitlyEnabled.transport, "webrtc");
  assert.equal(explicitlyEnabled.transportFallback, false);
  assert.equal(explicitlyEnabled.webrtc.enabled, true);

  const defaultTransport = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab"
  });
  assert.equal(defaultTransport.transport, "snapshot_polling");
  assert.equal(defaultTransport.webrtc.enabled, false);
  assert.deepEqual(defaultTransport.webrtc.stunUrls, []);
  assert.equal(defaultTransport.webrtc.hasTurn, false);
});

test("URLs de STUN/TURN sao filtradas por esquema e limitadas em quantidade", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_STUN_URLS: "stun:stun.lab.local:3478, javascript:alert(1), stun:stun2.lab.local:3478",
    REMOTE_ASSISTANCE_TURN_URL: "turn:turn.lab.local:3478",
    REMOTE_ASSISTANCE_TURN_USERNAME: "tecnico",
    REMOTE_ASSISTANCE_TURN_CREDENTIAL: "segredo-turn"
  });
  assert.deepEqual(config.webrtc.stunUrls, ["stun:stun.lab.local:3478", "stun:stun2.lab.local:3478"]);
  assert.equal(config.webrtc.hasTurn, true);
  assert.deepEqual(config.webrtc.iceServers, [
    { urls: "stun:stun.lab.local:3478" },
    { urls: "stun:stun2.lab.local:3478" },
    { urls: "turn:turn.lab.local:3478", username: "tecnico", credential: "segredo-turn" }
  ]);
});

test("sem TURN configurado, a lista de ICE servers fica so com STUN", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_STUN_URLS: "stun:stun.lab.local:3478"
  });
  assert.deepEqual(config.webrtc.iceServers, [{ urls: "stun:stun.lab.local:3478" }]);
});

test("sanitizeSdp sempre devolve o SDP terminado em CRLF, mesmo apos o trim de sanitizacao", () => {
  // SDP exige toda linha terminada em CRLF, inclusive a ultima. O trim() de
  // sanitizacao remove justamente esse terminador final -- sem repor, um
  // parser mais rigoroso (o do Chrome, por exemplo) rejeita o SDP inteiro.
  // Confirmado com uma negociacao WebRTC real de ponta a ponta.
  const withTrailingCrlf = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n";
  assert.equal(sanitizeSdp(withTrailingCrlf), withTrailingCrlf);

  const withoutTrailingCrlf = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0";
  assert.equal(sanitizeSdp(withoutTrailingCrlf), withoutTrailingCrlf + "\r\n");

  const withSurroundingWhitespace = "  \n" + withTrailingCrlf + "  \n";
  assert.equal(sanitizeSdp(withSurroundingWhitespace), withTrailingCrlf);

  assert.equal(sanitizeSdp(""), null);
  assert.equal(sanitizeSdp("nao comeca com v=0\r\n"), null);
  assert.equal(sanitizeSdp("v=0\r\n" + "a".repeat(20000)), null);
});

test("auto consentimento nunca e aceito em deploy publico", () => {
  const local = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_LAB_AUTO_CONSENT: "true"
  });
  const publicDeployment = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_LAB_AUTO_CONSENT: "true",
    VERCEL: "1"
  });

  assert.equal(local.autoConsentEnabled, true);
  assert.equal(publicDeployment.autoConsentEnabled, false);
});

test("modo de controle exige flag e permissao independentes", () => {
  const enabled = { controlEnabled: true };

  assert.equal(normalizeRequestedMode("view", enabled, false), "view");
  assert.equal(normalizeRequestedMode("control", enabled, true), "control");
  assert.throws(() => normalizeRequestedMode("control", enabled, false), /nao autorizado/i);
  assert.throws(
    () => normalizeRequestedMode("control", { controlEnabled: false }, true),
    /nao autorizado/i
  );
  assert.throws(() => normalizeRequestedMode("shell", enabled, true), /invalido/i);
});

test("entrada remota so e retransmitida durante sessao integralmente autorizada", () => {
  const session = {
    status: "active",
    requestedMode: "control",
    remoteControlEnabled: true,
    controlConsentGranted: true,
    consentStatus: "granted"
  };

  assert.equal(canRelayInput({ session, config: { controlEnabled: true }, canControl: true }), true);
  assert.equal(canRelayInput({ session, config: { controlEnabled: false }, canControl: true }), false);
  assert.equal(canRelayInput({ session: { ...session, status: "ended" }, config: { controlEnabled: true }, canControl: true }), false);
  assert.equal(canRelayInput({ session: { ...session, controlConsentGranted: false }, config: { controlEnabled: true }, canControl: true }), false);
});

test("agente e acao visual dependem de heartbeat, flags e permissoes", () => {
  const now = Date.now();
  const freshAsset = {
    source: "agent",
    lastSeenAt: new Date(now - 60_000).toISOString(),
    intervalSeconds: 60
  };
  const staleAsset = {
    ...freshAsset,
    lastSeenAt: new Date(now - 11 * 60_000).toISOString()
  };

  assert.equal(isAgentFresh(freshAsset, now), true);
  assert.equal(isRemoteAssistanceAssetFresh(freshAsset, now), true);
  assert.equal(isAgentFresh(staleAsset, now), false);
  assert.equal(isRemoteAssistanceAssetFresh(staleAsset, now), false);
  assert.equal(canShowRemoteAssistanceAction({
    frontendEnabled: true,
    backendEnabled: true,
    canView: true,
    canStart: true,
    eligible: true
  }), true);
  assert.equal(canShowRemoteAssistanceAction({
    frontendEnabled: true,
    backendEnabled: true,
    canView: true,
    canStart: false,
    eligible: true
  }), false);
});

test("deteccao do agente tambem considera asset.dataSources", () => {
  const now = Date.now();
  const mergedFromMonitoring = {
    source: "zabbix",
    dataSources: ["zabbix", "ocs", "agent"],
    lastSeenAt: new Date(now - 60_000).toISOString(),
    intervalSeconds: 60
  };
  const withoutAgentSource = {
    dataSources: ["manual"],
    lastSeenAt: new Date(now - 60_000).toISOString()
  };

  assert.equal(hasRemoteAssistanceAgent(mergedFromMonitoring), true);
  assert.equal(isRemoteAssistanceAssetFresh(mergedFromMonitoring, now), true);
  assert.equal(hasRemoteAssistanceAgent(withoutAgentSource), false);
  assert.equal(hasRemoteAssistanceAgent(null), false);
  assert.equal(hasRemoteAssistanceAgent({ dataSources: "agent" }), false);
});

test("estado de conexao deriva do status oficial sem depender do relay para estados terminais", () => {
  for (const status of ["waiting_consent", "consent_denied", "ended", "expired", "failed"]) {
    assert.equal(deriveConnectionState({ session: { status }, relay: null, config: {} }), status);
  }
  assert.equal(deriveConnectionState({ session: null }), "unknown");
});

test("sessao ativa sem nenhum frame ainda aparece como conectando", () => {
  const state = deriveConnectionState({
    session: { status: "active" },
    relay: { framesTotal: 0, lastFrameAt: 0 },
    config: { idleTimeoutSeconds: 60, agentTimeoutSeconds: 90 }
  });
  assert.equal(state, "connecting");
});

test("sessao ativa com frame recente fica ativa; frame antigo vira reconectando; muito antigo vira agente offline", () => {
  const now = 1_000_000;
  const config = { idleTimeoutSeconds: 60, agentTimeoutSeconds: 90 };
  const baseRelay = { framesTotal: 3 };

  assert.equal(
    deriveConnectionState({
      session: { status: "active" },
      relay: { ...baseRelay, lastFrameAt: now - 5_000 },
      config,
      now
    }),
    "active"
  );
  assert.equal(
    deriveConnectionState({
      session: { status: "active" },
      relay: { ...baseRelay, lastFrameAt: now - 65_000 },
      config,
      now
    }),
    "reconnecting"
  );
  assert.equal(
    deriveConnectionState({
      session: { status: "active" },
      relay: { ...baseRelay, lastFrameAt: now - 95_000 },
      config,
      now
    }),
    "agent_offline"
  );
});

test("controlador adaptativo reduz qualidade perto do limite e recupera aos poucos quando ha folga", () => {
  const config = {
    adaptiveQuality: true,
    minJpegQuality: 35,
    maxJpegQuality: 80,
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameBytes: 700000
  };

  const heavy = stepAdaptiveQuality({
    quality: 65,
    width: 1280,
    height: 720,
    lastFrameBytes: 650000,
    config
  });
  assert.equal(heavy.changed, true);
  assert.ok(heavy.quality < 65);

  const light = stepAdaptiveQuality({
    quality: 65,
    width: 1000,
    height: 560,
    lastFrameBytes: 100000,
    config
  });
  assert.equal(light.changed, true);
  assert.ok(light.width > 1000 || light.height > 560);

  const stable = stepAdaptiveQuality({
    quality: 65,
    width: 1280,
    height: 720,
    lastFrameBytes: 500000,
    config
  });
  assert.equal(stable.changed, false);
});

test("controlador adaptativo fica inerte quando a flag esta desligada ou nao ha dado de tamanho", () => {
  const config = {
    adaptiveQuality: false,
    minJpegQuality: 35,
    maxJpegQuality: 80,
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameBytes: 700000
  };
  const result = stepAdaptiveQuality({ quality: 65, width: 1280, height: 720, lastFrameBytes: 690000, config });
  assert.equal(result.changed, false);
  assert.equal(result.quality, 65);

  const configOn = { ...config, adaptiveQuality: true };
  const noData = stepAdaptiveQuality({ quality: 65, width: 1280, height: 720, lastFrameBytes: null, config: configOn });
  assert.equal(noData.changed, false);
});

test("labels e monitores mantem informacao operacional legivel", () => {
  assert.equal(isSessionActive("waiting_consent"), true);
  assert.equal(isSessionActive("ended"), false);
  assert.equal(remoteAssistanceStatusLabel("active"), "Atendimento em andamento");
  assert.equal(remoteAssistanceStatusLabel("reconnecting"), "Sem quadros recentes - reconectando");
  assert.equal(remoteAssistanceStatusLabel("agent_offline"), "Agente sem resposta");
  assert.equal(
    formatRemoteMonitor({ name: "Monitor 1", width: 1920, height: 1080, primary: true }),
    "Monitor 1 - 1920x1080 - Principal"
  );
});

test("rotulo de transporte distingue snapshot e webrtc", () => {
  assert.equal(remoteAssistanceTransportLabel("webrtc"), "WebRTC");
  assert.equal(remoteAssistanceTransportLabel("snapshot_polling"), "Snapshot seguro (HTTP)");
  assert.equal(remoteAssistanceTransportLabel(undefined), "Snapshot seguro (HTTP)");
});

test("formatacao de bytes/s e tamanho de quadro usa unidades legiveis", () => {
  assert.equal(formatBytesPerSecond(0), "0 B/s");
  assert.equal(formatBytesPerSecond(512), "512 B/s");
  assert.equal(formatBytesPerSecond(2048), "2.0 KB/s");
  assert.equal(formatBytesPerSecond(5 * 1024 * 1024), "5.0 MB/s");

  assert.equal(formatFrameSize(0), "0 B");
  assert.equal(formatFrameSize(900), "900 B");
  assert.equal(formatFrameSize(150 * 1024), "150.0 KB");
  assert.equal(formatFrameSize(3 * 1024 * 1024), "3.00 MB");
});

test("quadro atrasado e detectado com base na cadencia configurada do viewer", () => {
  assert.equal(isRemoteAssistanceFrameStale(null, 1000), false);
  assert.equal(isRemoteAssistanceFrameStale({ frameAgeMs: 500 }, 1000), false);
  assert.equal(isRemoteAssistanceFrameStale({ frameAgeMs: 4500 }, 1000), true);
  assert.equal(isRemoteAssistanceFrameStale({ frameAgeMs: 200 }, 100), false);
  assert.equal(isRemoteAssistanceFrameStale({ frameAgeMs: 1500 }, 100), true);
});
