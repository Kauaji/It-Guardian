import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import {
  MONITORS,
  adminUser,
  advance,
  openDialog,
  renderAction,
  startNativeSession,
  viewOnlyUser,
  wireApi
} from "./test/fixtures.jsx";

// Caracterizacao do ciclo de vida do transporte nativo: recusa de consentimento,
// expiracao/queda, expiracao do login e fechamento do dialogo.

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const implementationPath = import.meta.env.VITE_REMOTE_IMPL || "./RemoteAssistanceAction.jsx";
const { default: Action } = await import(/* @vite-ignore */ implementationPath);

let server;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "true");
  vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "false");
  vi.clearAllMocks();
  server = wireApi(api);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  document.body.style.overflow = "";
});

describe("recusa, expiracao e queda", () => {
  async function startAndGetDialog() {
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    return screen.getByRole("dialog");
  }

  it("consentimento recusado encerra o fluxo e para o polling", async () => {
    const dialog = await startAndGetDialog();
    server.session = { ...server.session, status: "consent_denied" };
    await advance(1300);
    expect(dialog).toHaveTextContent("Autorizacao negada");
    expect(screen.queryByRole("button", { name: /Encerrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reconectar/ })).not.toBeInTheDocument();
    expect(dialog.querySelector(".remote-assistance-status")).toHaveClass("status-consent_denied");
    const calls = api.fetchRemoteAssistanceSession.mock.calls.length;
    await advance(5000);
    expect(api.fetchRemoteAssistanceSession.mock.calls.length).toBe(calls);
    expect(api.fetchRemoteAssistanceFrame).not.toHaveBeenCalled();
  });

  it("sessao expirada e falha sao terminais", async () => {
    const dialog = await startAndGetDialog();
    server.session = { ...server.session, status: "expired" };
    await advance(1300);
    expect(dialog).toHaveTextContent("Sessao expirada");
    cleanup();

    server.session = makeFailed();
    const second = await startAndGetDialog();
    await advance(1300);
    expect(second).toHaveTextContent("Falha na sessao");
  });

  function makeFailed() {
    return { id: "sess-1", status: "failed", transport: "snapshot", monitors: [] };
  }

  it("queda do agente: mostra reconectando, quadro atrasado e permite reconectar", async () => {
    const dialog = await startAndGetDialog();
    server.session = {
      ...server.session,
      status: "active",
      connectionState: "reconnecting",
      monitors: [MONITORS[0]],
      selectedMonitorId: "m1"
    };
    server.metrics = { fps: 0, frameAgeMs: 9000 };
    await advance(1300);
    expect(dialog).toHaveTextContent("Sem quadros recentes - reconectando");
    expect(dialog.querySelector(".remote-assistance-status")).toHaveClass("status-reconnecting");
    expect(dialog).toHaveTextContent("Quadro atrasado - tentando atualizar...");
    expect(dialog).toHaveTextContent("A imagem aparecera quando o agente iniciar a transmissao.");

    const reconnect = screen.getByRole("button", { name: /Reconectar/ });
    expect(reconnect).toHaveAttribute("title", "Forcar nova tentativa de conexao");
    const before = api.fetchRemoteAssistanceFrame.mock.calls.length;
    await act(async () => {
      fireEvent.click(reconnect);
    });
    await advance(0);
    expect(api.fetchRemoteAssistanceFrame.mock.calls.length).toBeGreaterThan(before);

    server.session = { ...server.session, connectionState: "agent_offline" };
    await advance(1300);
    expect(dialog).toHaveTextContent("Agente sem resposta");
    expect(screen.getByRole("button", { name: /Reconectar/ })).toBeInTheDocument();
  });

  it("falha de rede no poll mostra o erro e some quando o poll volta a funcionar", async () => {
    const dialog = await startAndGetDialog();
    api.fetchRemoteAssistanceSession.mockRejectedValueOnce(new Error("Sem rede"));
    await advance(1300);
    expect(screen.getByRole("alert")).toHaveTextContent("Sem rede");
    expect(screen.getByRole("button", { name: /Reconectar/ })).toBeInTheDocument();
    await advance(1300);
    expect(dialog.querySelector(".form-error")).toBeNull();
  });

  it("falha ao buscar quadro mostra o erro", async () => {
    server.session = { ...server.session, status: "active" };
    api.fetchRemoteAssistanceFrame.mockRejectedValue(new Error("Quadro indisponivel"));
    await startAndGetDialog();
    await advance(1100);
    expect(screen.getByRole("alert")).toHaveTextContent("Quadro indisponivel");
  });

  it("falha ao encerrar mostra o erro e mantem a sessao", async () => {
    await startAndGetDialog();
    api.endRemoteAssistanceSession.mockRejectedValue(new Error("Nao foi possivel encerrar"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    });
    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Nao foi possivel encerrar");
    expect(screen.getByRole("button", { name: /Encerrar/ })).toBeEnabled();
  });

  it("expiracao do login do tecnico encerra a sessao em andamento", async () => {
    await startAndGetDialog();
    await act(async () => {
      window.dispatchEvent(new Event("it-guardian:auth-expired"));
    });
    expect(api.endRemoteAssistanceSession).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1"
    });
  });

  it("expiracao do login com falha ao encerrar nao quebra", async () => {
    await startAndGetDialog();
    api.endRemoteAssistanceSession.mockRejectedValue(new Error("x"));
    await act(async () => {
      window.dispatchEvent(new Event("it-guardian:auth-expired"));
    });
    await advance(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("expiracao do login sem sessao ativa nao chama a API", async () => {
    await renderAction(Action);
    await openDialog();
    window.dispatchEvent(new Event("it-guardian:auth-expired"));
    expect(api.endRemoteAssistanceSession).not.toHaveBeenCalled();
  });
});

describe("fechamento do dialogo", () => {
  async function startSessionDialog() {
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
  }

  it("pede confirmacao e permanece aberto quando o tecnico cancela", async () => {
    await startSessionDialog();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Fechar"));
    });
    await advance(0);
    expect(confirm).toHaveBeenCalledWith("Encerrar o atendimento remoto antes de fechar?");
    expect(api.endRemoteAssistanceSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("encerra a sessao e reseta o formulario quando confirmado", async () => {
    await startSessionDialog();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      fireEvent.click(screen.getByTitle("Fechar"));
    });
    await advance(0);
    expect(api.endRemoteAssistanceSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    confirm.mockRestore();

    await openDialog();
    expect(screen.getByPlaceholderText("Descreva o objetivo deste acesso")).toHaveValue("");
    expect(screen.getByPlaceholderText("Senha do seu login")).toHaveValue("");
  });

  it("fecha sem confirmar quando a sessao ja terminou", async () => {
    await startSessionDialog();
    server.session = { ...server.session, status: "ended" };
    await advance(1300);
    const confirm = vi.spyOn(window, "confirm");
    await act(async () => {
      fireEvent.click(screen.getByTitle("Fechar"));
    });
    await advance(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it("Escape fecha o dialogo sem sessao", async () => {
    await renderAction(Action);
    await openDialog();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    await advance(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("permissoes limitadas", () => {
  it("tecnico sem permissao de encerrar nao ve o botao Encerrar", async () => {
    await renderAction(Action, { user: viewOnlyUser });
    await openDialog();
    await startNativeSession();
    expect(screen.queryByRole("button", { name: /Encerrar/ })).not.toBeInTheDocument();
    expect(adminUser.role).toBe("admin");
  });
});
