import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

// Utilitarios dos testes de caracterizacao da assistencia remota: mock da API
// (barril ../../api.js), builders de ativo/sessao e helpers de tempo falso.
// Os arquivos de teste importam o componente via VITE_REMOTE_IMPL (padrao ./RemoteAssistanceAction.jsx)
// para permitir comparar outra implementacao.

export const API_NAMES = [
  "createRemoteAssistanceSession",
  "endRemoteAssistanceSession",
  "fetchRemoteAssistanceConfig",
  "fetchRemoteAssistanceEvents",
  "fetchRemoteAssistanceFrame",
  "fetchRemoteAssistanceRustdeskCredentials",
  "fetchRemoteAssistanceSession",
  "fetchRemoteAssistanceWebrtcAnswer",
  "reauthenticateRemoteAssistance",
  "selectRemoteAssistanceMonitor",
  "sendRemoteAssistanceChatMessage",
  "sendRemoteAssistanceInput",
  "sendRemoteAssistanceWebrtcOffer",
  "updateRemoteAssistanceCapture",
  "updateRemoteAssistanceControl"
];

export function createApiMock() {
  return Object.fromEntries(API_NAMES.map((name) => [name, vi.fn()]));
}

export const adminUser = { id: "u1", name: "Ana Admin", role: "admin" };
export const viewOnlyUser = {
  id: "u2",
  role: "viewer",
  effectivePermissions: ["remote_assistance.view", "remote_assistance.start"]
};

export function makeAsset(overrides = {}) {
  return {
    id: "asset-1",
    source: "agent",
    hostname: "LAB-01",
    name: "lab-01",
    ip: "10.0.0.5",
    os: "Windows 11 Pro",
    agentVersion: "1.2.3",
    localUser: "maria",
    lastSeenAt: new Date().toISOString(),
    ...overrides
  };
}

export const MONITORS = [
  { id: "m1", name: "Tela 1", primary: true, width: 1920, height: 1080 },
  { id: "m2", name: "Tela 2", width: 1280, height: 720 }
];

export function makeSession(overrides = {}) {
  return {
    id: "sess-1",
    status: "waiting_consent",
    transport: "snapshot",
    monitors: [],
    paused: false,
    ...overrides
  };
}

// "Servidor" falso: guarda a sessao corrente e conecta os mocks da API a ela.
export function wireApi(api, initial = {}) {
  const server = {
    session: makeSession(initial.session),
    events: initial.events || [],
    frame: initial.frame ?? null,
    metrics: initial.metrics || null,
    chatMessages: initial.chatMessages
  };
  api.fetchRemoteAssistanceConfig.mockResolvedValue({
    enabled: true,
    controlEnabled: true,
    viewerPollMs: 1000,
    ...initial.config
  });
  api.reauthenticateRemoteAssistance.mockResolvedValue({ token: "reauth-1" });
  api.createRemoteAssistanceSession.mockImplementation(async () => ({
    session: server.session,
    viewerToken: "viewer-1"
  }));
  api.fetchRemoteAssistanceSession.mockImplementation(async () => ({ session: { ...server.session } }));
  api.fetchRemoteAssistanceEvents.mockImplementation(async () => ({ events: server.events }));
  api.fetchRemoteAssistanceFrame.mockImplementation(async () => ({
    frame: server.frame,
    metrics: server.metrics,
    chatMessages: server.chatMessages
  }));
  api.endRemoteAssistanceSession.mockImplementation(async () => {
    server.session = { ...server.session, status: "ended" };
    return { session: server.session };
  });
  api.updateRemoteAssistanceCapture.mockImplementation(async ({ paused }) => {
    server.session = { ...server.session, paused };
    return { session: server.session };
  });
  api.updateRemoteAssistanceControl.mockImplementation(async ({ enabled }) => {
    server.session = { ...server.session, remoteControlEnabled: enabled };
    return { session: server.session };
  });
  api.selectRemoteAssistanceMonitor.mockImplementation(async ({ monitorId }) => {
    server.session = { ...server.session, selectedMonitorId: monitorId };
    return { session: server.session };
  });
  api.sendRemoteAssistanceInput.mockResolvedValue({});
  api.sendRemoteAssistanceChatMessage.mockImplementation(async ({ text }) => ({
    message: { id: `msg-${text}`, sender: "technician", text, createdAt: "2026-08-15T12:00:00.000Z" }
  }));
  return server;
}

export async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

export async function renderAction(Action, props = {}) {
  const notify = props.notify || vi.fn();
  const view = render(
    <Action
      asset={makeAsset()}
      token="tok-1"
      user={adminUser}
      notify={notify}
      {...props}
    />
  );
  await advance(0);
  return { ...view, notify };
}

export async function openDialog() {
  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: /remoto|Acessar m/i })[0]);
  });
  await advance(0);
}

export async function startNativeSession({ reason = "Verificar lentidao", password = "segredo" } = {}) {
  fireEvent.change(screen.getByPlaceholderText("Descreva o objetivo deste acesso"), { target: { value: reason } });
  fireEvent.change(screen.getByPlaceholderText("Senha do seu login"), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Solicitar atendimento/ }));
  });
  await advance(0);
}
