import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { advance, openDialog, renderAction, startNativeSession, wireApi } from "./test/fixtures.jsx";

// Caracterizacao do transporte RustDesk (cliente nativo): credenciais por
// sessao reveladas sob demanda, copiar id/senha, expiracao e encerramento.

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const implementationPath = import.meta.env.VITE_REMOTE_IMPL || "./RemoteAssistanceAction.jsx";
const { default: Action } = await import(/* @vite-ignore */ implementationPath);

const SECRET = "Zx9-secreta-sessao";
let server;
let writeText;
let consoleSpies;

function credentials(overrides = {}) {
  return { rustdeskId: "123 456 789", password: SECRET, expiresAt: new Date(Date.now() + 30_000).toISOString(), ...overrides };
}

async function startRustdesk(sessionOverrides = {}) {
  server.session = { ...server.session, transport: "rustdesk", ...sessionOverrides };
  const view = await renderAction(Action);
  await openDialog();
  await startNativeSession();
  return view;
}

async function click(element) {
  await act(async () => {
    fireEvent.click(element);
  });
  await advance(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "true");
  vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "false");
  vi.clearAllMocks();
  server = wireApi(api);
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  consoleSpies = ["log", "info", "warn", "error", "debug"].map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  consoleSpies.forEach((spy) => spy.mockRestore());
  vi.useRealTimers();
  vi.unstubAllEnvs();
  document.body.style.overflow = "";
});

describe("transporte RustDesk", () => {
  it("enquanto aguarda consentimento nao emite credencial nem mostra o botao de revelar", async () => {
    await startRustdesk({ status: "waiting_consent" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Transporte: RustDesk (cliente nativo)");
    expect(dialog).toHaveTextContent("Aguardando resposta na máquina");
    expect(dialog).toHaveTextContent("A credencial de conexão só é emitida após o usuário autorizar localmente.");
    expect(screen.queryByRole("button", { name: /Revelar senha/ })).not.toBeInTheDocument();
    await advance(3000);
    expect(api.fetchRemoteAssistanceRustdeskCredentials).not.toHaveBeenCalled();
  });

  it("nao mostra controles de tela do snapshot/WebRTC nem metricas", async () => {
    await startRustdesk({ status: "active", monitors: [{ id: "m1", name: "T", width: 1, height: 1 }] });
    const dialog = screen.getByRole("dialog");
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Maximizar/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tela remota")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("FPS real");
    expect(dialog).not.toHaveTextContent("único monitor");
    expect(screen.getByRole("button", { name: /Encerrar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar chat/ })).toBeInTheDocument();
  });

  it("ativa: pede o id da maquina e so revela a senha sob demanda", async () => {
    await startRustdesk({ status: "active" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Id RustDesk desta máquina");
    expect(dialog).toHaveTextContent("Não relatado ainda pelo agente");
    expect(dialog).not.toHaveTextContent(SECRET);
    expect(screen.queryByRole("link", { name: /Abrir no cliente RustDesk/ })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("A senha nunca vai por link: cole-a manualmente no cliente RustDesk.");

    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));

    expect(api.fetchRemoteAssistanceRustdeskCredentials).toHaveBeenCalledTimes(1);
    expect(api.fetchRemoteAssistanceRustdeskCredentials).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1"
    });
    expect(dialog).toHaveTextContent("123 456 789");
    expect(dialog).toHaveTextContent(SECRET);
    expect(dialog).toHaveTextContent("Senha desta sessão (expira em 30s)");
    expect(screen.queryByRole("button", { name: /Revelar senha de conexão/ })).not.toBeInTheDocument();

    // O link rustdesk:// leva so o id; a senha nunca vai em URL.
    const link = screen.getByRole("link", { name: /Abrir no cliente RustDesk/ });
    expect(link).toHaveAttribute("href", "rustdesk://123 456 789");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link.getAttribute("href")).not.toContain(SECRET);
    expect(document.body.innerHTML.match(/href="[^"]*"/g).join(" ")).not.toContain(SECRET);

    // Contagem regressiva.
    await advance(10_000);
    expect(dialog).toHaveTextContent("expira em 20s");
  });

  it("copia id e senha para a area de transferencia e avisa", async () => {
    const { notify } = await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));

    await click(screen.getByTitle("Copiar id"));
    expect(writeText).toHaveBeenLastCalledWith("123 456 789");
    expect(notify).toHaveBeenCalledWith("Id copiado.", "ok");

    await click(screen.getByTitle("Copiar senha"));
    expect(writeText).toHaveBeenLastCalledWith(SECRET);
    expect(notify).toHaveBeenCalledWith("Senha copiado.", "ok");
  });

  it("falha ao copiar orienta copiar manualmente, sem expor a senha", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    writeText.mockRejectedValue(new Error("negado"));
    await click(screen.getByTitle("Copiar senha"));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível copiar senha automaticamente. Copie manualmente.");
    expect(screen.getByRole("alert")).not.toHaveTextContent(SECRET);
  });

  it("copiar funciona sem a funcao notify", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    await click(screen.getByTitle("Copiar id"));
    expect(writeText).toHaveBeenCalled();
  });

  it("a senha expira sozinha e permite gerar outra", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials({ expiresAt: new Date(Date.now() + 3000).toISOString() }));
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(SECRET);

    await advance(4000);
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveTextContent(SECRET);
    expect(dialog).toHaveTextContent("123 456 789");
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials({ password: "outra-senha" }));
    await click(screen.getByRole("button", { name: /Gerar nova senha de sessão/ }));
    expect(api.fetchRemoteAssistanceRustdeskCredentials).toHaveBeenCalledTimes(2);
    expect(dialog).toHaveTextContent("outra-senha");
  });

  it("credenciais sem expiracao nao iniciam contagem", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue({ rustdeskId: "1", password: SECRET });
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Senha desta sessão (expira em s)");
  });

  it("erro ao revelar mostra o alerta e nao deixa credencial na tela", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockRejectedValue(new Error("Sem credencial disponivel"));
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Sem credencial disponivel");
    expect(screen.getByRole("button", { name: /Revelar senha de conexão/ })).toBeEnabled();
  });

  it("desabilita o botao enquanto a credencial esta sendo buscada", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockReturnValue(new Promise(() => {}));
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    expect(screen.getByRole("button", { name: /Revelar senha de conexão/ })).toBeDisabled();
  });

  it("encerrar oculta as credenciais da tela", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent(SECRET);

    await click(screen.getByRole("button", { name: /Encerrar/ }));
    expect(api.endRemoteAssistanceSession).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).not.toHaveTextContent(SECRET);
    expect(screen.getByRole("dialog")).toHaveTextContent("Atendimento encerrado");
  });

  it("nunca persiste credenciais em storage nem as escreve no console", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    await click(screen.getByTitle("Copiar senha"));
    await advance(5000);
    await click(screen.getByRole("button", { name: /Encerrar/ }));

    const stored = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain("viewer-1");
    expect(stored).not.toContain("segredo");
    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
      expect(JSON.stringify(spy.mock.calls)).not.toContain("segredo");
    }
  });

  it("fechar o dialogo descarta as credenciais reveladas", async () => {
    await startRustdesk({ status: "active" });
    api.fetchRemoteAssistanceRustdeskCredentials.mockResolvedValue(credentials());
    await click(screen.getByRole("button", { name: /Revelar senha de conexão/ }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await click(screen.getByTitle("Fechar"));
    confirm.mockRestore();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SECRET);
  });
});
