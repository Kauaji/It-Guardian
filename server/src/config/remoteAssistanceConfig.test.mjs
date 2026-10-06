import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { getRemoteAssistanceConfig } from "./environment.js";

// Golden test: a configuracao completa da assistencia remota para uma matriz de
// ambientes. Qualquer mudanca de comportamento na leitura das variaveis aparece
// como diferenca neste JSON. Para regenerar de proposito:
//   UPDATE_GOLDEN=1 node --test src/config/remoteAssistanceConfig.test.mjs
const goldenPath = new URL("./fixtures/remote-assistance-config.golden.json", import.meta.url);

const lab = { ENABLE_REMOTE_ASSISTANCE: "true", REMOTE_ASSISTANCE_ENV: "lab" };

export const scenarios = {
  vazio: {},
  desligado_em_producao: { ENABLE_REMOTE_ASSISTANCE: "true", NODE_ENV: "production" },
  ambiente_teste_por_node_env: { ENABLE_REMOTE_ASSISTANCE: "1", NODE_ENV: "test" },
  laboratorio_padroes: { ...lab },
  laboratorio_controle_e_privacidade: {
    ...lab,
    ENABLE_REMOTE_ASSISTANCE_CONTROL: "sim",
    ENABLE_REMOTE_PRIVACY_MODE: "true",
    ENABLE_REMOTE_ADMIN_ACTIONS: "yes"
  },
  controle_por_flag_nova_tem_precedencia: { ...lab, ENABLE_REMOTE_CONTROL: "false", ENABLE_REMOTE_ASSISTANCE_CONTROL: "true" },
  consentimento_automatico_no_laboratorio: { ...lab, REMOTE_ASSISTANCE_LAB_AUTO_CONSENT: "true" },
  consentimento_automatico_bloqueado_em_deploy_publico: { ...lab, VERCEL: "1", ENABLE_REMOTE_ASSISTANCE_AUTO_CONSENT: "true" },
  limites_minimos: {
    ...lab,
    REMOTE_ASSISTANCE_MAX_FPS: "0",
    REMOTE_ASSISTANCE_TARGET_FPS: "0",
    REMOTE_ASSISTANCE_MIN_JPEG_QUALITY: "1",
    REMOTE_ASSISTANCE_MAX_JPEG_QUALITY: "1",
    REMOTE_ASSISTANCE_JPEG_QUALITY: "1",
    REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS: "1",
    REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS: "1",
    REMOTE_ASSISTANCE_AGENT_CAPTURE_MS: "1",
    REMOTE_ASSISTANCE_VIEWER_POLL_MS: "1",
    REMOTE_ASSISTANCE_SESSION_TTL_MINUTES: "1",
    REMOTE_ASSISTANCE_MAX_FRAME_BYTES: "1",
    REMOTE_ASSISTANCE_MAX_WIDTH: "1",
    REMOTE_ASSISTANCE_MAX_HEIGHT: "1",
    REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS: "1",
    REMOTE_ASSISTANCE_MAX_QUEUED_COMMANDS: "1",
    REMOTE_ASSISTANCE_ADAPTIVE_QUALITY: "false"
  },
  limites_maximos: {
    ...lab,
    REMOTE_ASSISTANCE_MAX_FPS: "999",
    REMOTE_ASSISTANCE_TARGET_FPS: "999",
    REMOTE_ASSISTANCE_MIN_JPEG_QUALITY: "999",
    REMOTE_ASSISTANCE_MAX_JPEG_QUALITY: "999",
    REMOTE_ASSISTANCE_JPEG_QUALITY: "999",
    REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS: "99999",
    REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS: "99999",
    REMOTE_ASSISTANCE_AGENT_CAPTURE_MS: "99999",
    REMOTE_ASSISTANCE_VIEWER_POLL_MS: "99999",
    REMOTE_ASSISTANCE_SESSION_TTL_MINUTES: "999",
    REMOTE_ASSISTANCE_MAX_FRAME_BYTES: "99999999",
    REMOTE_ASSISTANCE_MAX_WIDTH: "99999",
    REMOTE_ASSISTANCE_MAX_HEIGHT: "99999",
    REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS: "9999",
    REMOTE_ASSISTANCE_MAX_QUEUED_COMMANDS: "9999"
  },
  fps_e_captura_personalizados: {
    ...lab,
    REMOTE_ASSISTANCE_MAX_FPS: "4",
    REMOTE_ASSISTANCE_TARGET_FPS: "9",
    REMOTE_ASSISTANCE_AGENT_CAPTURE_MS: "300"
  },
  webrtc_solicitado_e_habilitado: {
    ...lab,
    REMOTE_ASSISTANCE_TRANSPORT: " WebRTC ",
    REMOTE_ASSISTANCE_WEBRTC_ENABLED: "true",
    REMOTE_ASSISTANCE_STUN_URLS: "stun:a.example.com:3478, stuns:b.example.com, http://ruim.example.com, stun:c, stun:d, stun:e",
    REMOTE_ASSISTANCE_TURN_URL: "turns:turn.example.com:5349,turn:outro",
    REMOTE_ASSISTANCE_TURN_USERNAME: " usuario ",
    REMOTE_ASSISTANCE_TURN_CREDENTIAL: "segredo",
    REMOTE_ASSISTANCE_MAX_BITRATE_KBPS: "100"
  },
  webrtc_solicitado_sem_flag: { ...lab, REMOTE_ASSISTANCE_TRANSPORT: "webrtc" },
  turn_sem_credenciais: { ...lab, REMOTE_ASSISTANCE_WEBRTC_ENABLED: "true", REMOTE_ASSISTANCE_TURN_URL: "turn:turn.example.com" },
  rustdesk_habilitado: {
    ...lab,
    REMOTE_ASSISTANCE_TRANSPORT: "rustdesk",
    REMOTE_ASSISTANCE_RUSTDESK_ENABLED: "true",
    REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER: " id.example.com ",
    REMOTE_ASSISTANCE_RUSTDESK_RELAY_SERVER: "relay.example.com",
    REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_TTL_SECONDS: "9999",
    REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_LENGTH: "4"
  },
  rustdesk_sem_servidor_cai_para_snapshot: { ...lab, REMOTE_ASSISTANCE_TRANSPORT: "rustdesk", REMOTE_ASSISTANCE_RUSTDESK_ENABLED: "true" },
  rustdesk_e_webrtc_juntos: {
    ...lab,
    REMOTE_ASSISTANCE_TRANSPORT: "webrtc",
    REMOTE_ASSISTANCE_WEBRTC_ENABLED: "true",
    REMOTE_ASSISTANCE_RUSTDESK_ENABLED: "true",
    REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER: "id.example.com"
  },
  transporte_desconhecido: { ...lab, REMOTE_ASSISTANCE_TRANSPORT: "pombo_correio" }
};

test("configuracao da assistencia remota permanece identica para a matriz de ambientes", () => {
  const actual = Object.fromEntries(Object.entries(scenarios).map(([name, env]) => [name, getRemoteAssistanceConfig(env)]));
  const normalized = JSON.parse(JSON.stringify(actual));

  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(goldenPath)) {
    writeFileSync(goldenPath, `${JSON.stringify(normalized, null, 2)}\n`);
  }
  assert.deepEqual(normalized, JSON.parse(readFileSync(goldenPath, "utf8")));
});
