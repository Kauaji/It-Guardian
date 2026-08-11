import assert from "node:assert/strict";
import test from "node:test";

import { getRemoteAssistanceConfig } from "../config/environment.js";
import {
  assertRemoteAssistanceEnabled,
  canRelayInput,
  isAgentFresh,
  isSessionActive,
  normalizeRequestedMode
} from "./remoteAssistancePolicy.js";
import {
  canShowRemoteAssistanceAction,
  formatRemoteMonitor,
  isRemoteAssistanceAssetFresh,
  remoteAssistanceStatusLabel
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

test("modo laboratorio habilita captura e limita o fallback a um FPS", () => {
  const config = getRemoteAssistanceConfig({
    ENABLE_REMOTE_ASSISTANCE: "true",
    ENABLE_REMOTE_CONTROL: "true",
    REMOTE_ASSISTANCE_ENV: "lab",
    REMOTE_ASSISTANCE_MAX_FPS: "9"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.captureEnabled, true);
  assert.equal(config.controlEnabled, true);
  assert.equal(config.maxFramesPerSecond, 1);
  assert.equal(config.privacyModeEnabled, false);
  assert.equal(config.adminActionsEnabled, false);
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

test("labels e monitores mantem informacao operacional legivel", () => {
  assert.equal(isSessionActive("waiting_consent"), true);
  assert.equal(isSessionActive("ended"), false);
  assert.equal(remoteAssistanceStatusLabel("active"), "Atendimento em andamento");
  assert.equal(
    formatRemoteMonitor({ name: "Monitor 1", width: 1920, height: 1080, primary: true }),
    "Monitor 1 - 1920x1080 - Principal"
  );
});
