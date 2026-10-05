import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import {
  MONITORS,
  adminUser,
  advance,
  makeAsset,
  openDialog,
  renderAction,
  startNativeSession,
  viewOnlyUser,
  wireApi
} from "./test/fixtures.jsx";

// Caracterizacao do fluxo do transporte nativo (snapshots HTTP): reautenticacao,
// pedido, consentimento, sessao ativa, pausa/retomada e encerramento.

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

describe("visibilidade do gatilho", () => {
  it("nao renderiza nada quando o front esta desabilitado", async () => {
    vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "false");
    const { container } = await renderAction(Action);
    expect(container).toBeEmptyDOMElement();
  });

  it("nao renderiza quando o ativo esta offline e o modo nao e compacto", async () => {
    const { container } = await renderAction(Action, { asset: makeAsset({ lastSeenAt: "2020-01-01T00:00:00Z" }) });
    expect(container).toBeEmptyDOMElement();
  });

  it("no modo compacto mantem o botao desabilitado explicando o motivo (agente sem contato)", async () => {
    await renderAction(Action, { compact: true, asset: makeAsset({ lastSeenAt: "2020-01-01T00:00:00Z" }) });
    const button = screen.getByRole("button", { name: "Atendimento remoto" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Agente offline ou sem contato recente");
    expect(button).toHaveClass("icon-button");
    expect(button).toHaveTextContent("");
  });

  it("explica a indisponibilidade por permissao e pelo backend", async () => {
    await renderAction(Action, { compact: true, user: { id: "x", role: "viewer", effectivePermissions: [] } });
    expect(screen.getByRole("button", { name: "Atendimento remoto" })).toHaveAttribute(
      "title",
      "Sem permissao para atendimento remoto"
    );
    cleanup();

    api.fetchRemoteAssistanceConfig.mockResolvedValue({ enabled: false });
    await renderAction(Action, { compact: true });
    expect(screen.getByRole("button", { name: "Atendimento remoto" })).toHaveAttribute(
      "title",
      "Atendimento remoto indisponivel"
    );
    cleanup();

    api.fetchRemoteAssistanceConfig.mockReturnValue(new Promise(() => {}));
    await renderAction(Action, { compact: true });
    expect(screen.getByRole("button", { name: "Atendimento remoto" })).toHaveAttribute(
      "title",
      "Verificando atendimento remoto"
    );
  });

  it("explica a indisponibilidade quando o front esta desligado (modo compacto)", async () => {
    vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "false");
    await renderAction(Action, { compact: true });
    expect(screen.getByRole("button", { name: "Atendimento remoto" })).toHaveAttribute(
      "title",
      "Atendimento remoto nao habilitado"
    );
    expect(api.fetchRemoteAssistanceConfig).not.toHaveBeenCalled();
  });

  it("falha ao carregar a configuracao mantem o gatilho oculto", async () => {
    api.fetchRemoteAssistanceConfig.mockRejectedValue(new Error("boom"));
    const { container } = await renderAction(Action);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra rotulos do gatilho completo e da ordem de servico", async () => {
    await renderAction(Action);
    const trigger = screen.getByRole("button", { name: "Atendimento remoto" });
    expect(trigger).toHaveTextContent("Atendimento remoto");
    expect(trigger).toHaveClass("ghost-action", "remote-assistance-trigger");
    expect(trigger).toHaveAttribute("title", "Atendimento remoto");
    cleanup();

    await renderAction(Action, { serviceOrder: { id: "os-1", number: "OS-7" } });
    expect(screen.getByRole("button", { name: "Acessar maquina" })).toHaveAttribute("title", "Acessar maquina");
  });

  it("no modo compacto o clique nao propaga para o cartao", async () => {
    const onCardClick = vi.fn();
    await renderAction(Action, { compact: true });
    document.body.addEventListener("click", onCardClick);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Atendimento remoto" }));
    });
    document.body.removeEventListener("click", onCardClick);
    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("formulario de reautenticacao", () => {
  it("mostra resumo da maquina, motivo, permissao somente visualizar e aviso de seguranca", async () => {
    await renderAction(Action, { serviceOrder: { id: "os-1", number: "OS-7" } });
    await openDialog();
    const dialog = screen.getByRole("dialog", { name: "Assistencia remota" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("heading", { name: "lab-01" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("LAB-01 - 10.0.0.5");
    expect(dialog).toHaveTextContent("Windows 11 Pro");
    expect(dialog).toHaveTextContent("1.2.3");
    expect(dialog).toHaveTextContent("maria");
    expect(dialog).toHaveTextContent("Vinculado a OS OS-7");
    expect(within(dialog).getByRole("radio", { name: /Somente visualizar/ })).toBeChecked();
    expect(within(dialog).queryByRole("radio", { name: /Solicitar mouse e teclado/ })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("O usuario precisa autorizar localmente");
    expect(dialog).toHaveTextContent("Modo privacidade e acoes administrativas permanecem indisponiveis nesta fase.");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("usa valores de reserva quando o ativo nao traz os dados", async () => {
    const sparse = { id: "asset-2", source: "agent", name: "sem-info", lastSeenAt: new Date().toISOString() };
    await renderAction(Action, { asset: sparse });
    await openDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("sem-info - IP nao informado");
    expect(dialog).toHaveTextContent("Nao informado");
    expect(dialog).toHaveTextContent("Ativo");
    expect(dialog).toHaveTextContent("Nao coletado");
  });

  it("oferece mouse e teclado apenas com o controle habilitado no front, backend e permissao", async () => {
    vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "true");
    await renderAction(Action);
    await openDialog();
    const control = screen.getByRole("radio", { name: /Solicitar mouse e teclado/ });
    fireEvent.click(control);
    expect(control).toBeChecked();
    expect(screen.getByRole("radio", { name: /Somente visualizar/ })).not.toBeChecked();
  });

  it("fecha pelo botao Fechar quando nao ha sessao e restaura o scroll do body", async () => {
    await renderAction(Action);
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByTitle("Fechar"));
    });
    await advance(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("senha errada: mostra o erro, limpa a senha e nao cria a sessao", async () => {
    api.reauthenticateRemoteAssistance.mockRejectedValue(new Error("Senha incorreta."));
    await renderAction(Action);
    await openDialog();
    await startNativeSession({ password: "errada" });
    expect(screen.getByRole("alert")).toHaveTextContent("Senha incorreta.");
    expect(screen.getByPlaceholderText("Senha do seu login")).toHaveValue("");
    expect(screen.getByPlaceholderText("Descreva o objetivo deste acesso")).toHaveValue("Verificar lentidao");
    expect(api.createRemoteAssistanceSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Solicitar atendimento/ })).toBeEnabled();
  });

  it("falha na criacao da sessao tambem limpa a senha", async () => {
    api.createRemoteAssistanceSession.mockRejectedValue(new Error("Maquina ocupada."));
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    expect(screen.getByRole("alert")).toHaveTextContent("Maquina ocupada.");
    expect(screen.getByPlaceholderText("Senha do seu login")).toHaveValue("");
  });

  it("desabilita o envio enquanto a reautenticacao esta em andamento", async () => {
    api.reauthenticateRemoteAssistance.mockReturnValue(new Promise(() => {}));
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    expect(screen.getByRole("button", { name: /Solicitar atendimento/ })).toBeDisabled();
  });
});

describe("fluxo feliz do transporte nativo", () => {
  it("reauth -> pedido -> aguardando consentimento -> ativa -> pausar/retomar -> encerrar", async () => {
    const { notify } = await renderAction(Action, {
      serviceOrder: { id: "os-1", number: "OS-7" }
    });
    await openDialog();
    await startNativeSession();

    expect(api.reauthenticateRemoteAssistance).toHaveBeenCalledWith({
      token: "tok-1",
      password: "segredo",
      assetId: "asset-1",
      serviceOrderId: "os-1"
    });
    expect(api.createRemoteAssistanceSession).toHaveBeenCalledWith({
      token: "tok-1",
      assetId: "asset-1",
      serviceOrderId: "os-1",
      reason: "Verificar lentidao",
      requestedMode: "view",
      reauthenticationToken: "reauth-1"
    });
    expect(notify).toHaveBeenCalledWith("Solicitacao enviada ao usuario da maquina.", "ok");

    // Aguardando consentimento.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Aguardando autorizacao local");
    expect(dialog).toHaveTextContent("Aguardando resposta na maquina.");
    expect(dialog).toHaveTextContent("Transporte: Snapshot seguro (HTTP)");
    expect(dialog).toHaveTextContent("Nenhum evento recebido ainda.");
    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Encerrar/ })).toBeEnabled();
    expect(api.fetchRemoteAssistanceFrame).not.toHaveBeenCalled();

    // Usuario local autoriza; a sessao passa a ativa no proximo poll.
    server.session = {
      ...server.session,
      status: "active",
      monitors: [MONITORS[0]],
      selectedMonitorId: "m1"
    };
    server.frame = "AAAA";
    server.metrics = { fps: 4.5, bytesPerSecond: 2048, quality: 70, lastFrameBytes: 1536, frameAgeMs: 100 };
    server.events = [{ id: "e1", createdAt: "2026-08-15T12:30:00.000Z", message: "Consentimento concedido" }];
    await advance(1300);

    expect(dialog).toHaveTextContent("Atendimento em andamento");
    expect(dialog).toHaveTextContent("Tela 1 - 1920x1080 - Principal (unico monitor)");
    expect(dialog).toHaveTextContent("Consentimento concedido");
    expect(dialog).toHaveTextContent("FPS real: 4.5");
    expect(dialog).toHaveTextContent("Banda: 2.0 KB/s");
    expect(dialog).toHaveTextContent("Qualidade: 70%");
    expect(dialog).toHaveTextContent("Ultimo quadro: 1.5 KB");
    expect(dialog).toHaveTextContent("Controle: inativo");
    expect(dialog).toHaveTextContent(/Latencia HTTP: \d+ ms/);
    const image = within(dialog).getByAltText("Tela remota de lab-01");
    expect(image).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
    expect(image).toHaveAttribute("draggable", "false");
    expect(within(dialog).getByLabelText("Tela remota")).toHaveStyle({ aspectRatio: "1920 / 1080" });
    expect(api.fetchRemoteAssistanceFrame).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1"
    });

    // Quadros ja em formato data URL ficam como estao.
    server.frame = "data:image/png;base64,BBBB";
    await advance(1100);
    expect(within(dialog).getByAltText("Tela remota de lab-01")).toHaveAttribute(
      "src",
      "data:image/png;base64,BBBB"
    );

    // Pausar.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    });
    await advance(0);
    expect(api.updateRemoteAssistanceCapture).toHaveBeenLastCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      paused: true
    });
    expect(screen.getByRole("button", { name: /Retomar/ })).toHaveAttribute("title", "Retomar visualizacao");
    expect(dialog).toHaveTextContent("Visualizacao pausada");
    const framesWhilePaused = api.fetchRemoteAssistanceFrame.mock.calls.length;
    await advance(3000);
    expect(api.fetchRemoteAssistanceFrame.mock.calls.length).toBe(framesWhilePaused);

    // Retomar.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Retomar/ }));
    });
    await advance(0);
    expect(api.updateRemoteAssistanceCapture).toHaveBeenLastCalledWith(expect.objectContaining({ paused: false }));
    expect(screen.getByRole("button", { name: /Pausar/ })).toHaveAttribute("title", "Pausar visualizacao");
    expect(dialog).not.toHaveTextContent("Visualizacao pausada");
    expect(api.fetchRemoteAssistanceFrame.mock.calls.length).toBeGreaterThan(framesWhilePaused);

    // Encerrar.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    });
    await advance(0);
    expect(api.endRemoteAssistanceSession).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1"
    });
    expect(notify).toHaveBeenCalledWith("Atendimento remoto encerrado.", "ok");
    expect(dialog).toHaveTextContent("Atendimento encerrado");
    expect(screen.queryByRole("button", { name: /Encerrar/ })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Tela remota de lab-01")).not.toBeInTheDocument();

    // Sessao terminal: nada mais e consultado.
    const sessionCalls = api.fetchRemoteAssistanceSession.mock.calls.length;
    await advance(5000);
    expect(api.fetchRemoteAssistanceSession.mock.calls.length).toBe(sessionCalls);
  });

  it("mostra seletor de monitores quando ha mais de um e troca o monitor", async () => {
    server.session = { ...server.session, status: "active", monitors: MONITORS, selectedMonitorId: "m1" };
    server.frame = "AAAA";
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    await advance(1300);

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("m1");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tela 1 - 1920x1080 - Principal",
      "Tela 2 - 1280x720"
    ]);
    await act(async () => {
      fireEvent.change(select, { target: { value: "m2" } });
    });
    await advance(0);
    expect(api.selectRemoteAssistanceMonitor).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      monitorId: "m2"
    });
    expect(screen.getByLabelText("Tela remota")).toHaveStyle({ aspectRatio: "1280 / 720" });
  });

  it("falha ao trocar de monitor e ao pausar mostram o erro", async () => {
    server.session = { ...server.session, status: "active", monitors: MONITORS, selectedMonitorId: "m1" };
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    await advance(1300);

    api.selectRemoteAssistanceMonitor.mockRejectedValue(new Error("Monitor indisponivel"));
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "m2" } });
    });
    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Monitor indisponivel");

    api.updateRemoteAssistanceCapture.mockRejectedValue(new Error("Pausa recusada"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    });
    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Pausa recusada");
  });
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
