import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { MONITORS, advance, openDialog, renderAction, startNativeSession, viewOnlyUser, wireApi } from "./test/fixtures.jsx";

// Caracterizacao de controle remoto (mouse/teclado), maximizar e chat.

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const implementationPath = import.meta.env.VITE_REMOTE_IMPL || "./RemoteAssistanceAction.jsx";
const { default: Action } = await import(/* @vite-ignore */ implementationPath);

let server;

async function click(element) {
  await act(async () => {
    fireEvent.click(element);
  });
  await advance(0);
}

async function startControlSession(sessionOverrides = {}, props = {}) {
  server.session = {
    ...server.session,
    status: "active",
    monitors: [MONITORS[0]],
    selectedMonitorId: "m1",
    remoteControlEnabled: true,
    controlConsentGranted: true,
    ...sessionOverrides
  };
  await renderAction(Action, props);
  await openDialog();
  fireEvent.click(screen.getByRole("radio", { name: /Solicitar mouse e teclado/ }));
  await startNativeSession();
  await advance(1300);
  const screenArea = screen.getByLabelText("Tela remota");
  screenArea.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100 });
  return screenArea;
}

function lastInput() {
  const calls = api.sendRemoteAssistanceInput.mock.calls;
  return calls[calls.length - 1]?.[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "true");
  vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "true");
  vi.clearAllMocks();
  server = wireApi(api);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  document.body.style.overflow = "";
});

describe("controle remoto", () => {
  it("com controle ativo encaminha mouse, roda e teclado ao agente", async () => {
    const area = await startControlSession();
    expect(area).toHaveClass("control-active");
    expect(area).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("dialog")).toHaveTextContent("Controle: ativo");

    await advance(200);
    fireEvent.mouseMove(area, { clientX: 110, clientY: 70 });
    expect(lastInput()).toEqual({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      command: { type: "mouse_move", x: 0.5, y: 0.5 }
    });

    // Movimentos dentro de 80 ms sao descartados.
    const moves = api.sendRemoteAssistanceInput.mock.calls.length;
    fireEvent.mouseMove(area, { clientX: 120, clientY: 70 });
    expect(api.sendRemoteAssistanceInput.mock.calls.length).toBe(moves);
    await advance(100);
    fireEvent.mouseMove(area, { clientX: 5000, clientY: -50 });
    expect(lastInput().command).toEqual({ type: "mouse_move", x: 1, y: 0 });

    fireEvent.mouseDown(area, { button: 2, clientX: 10, clientY: 20 });
    const sent = api.sendRemoteAssistanceInput.mock.calls.slice(-2).map((call) => call[0].command);
    expect(sent).toEqual([
      { type: "mouse_move", x: 0, y: 0 },
      { type: "mouse_button", button: "right", action: "down" }
    ]);
    fireEvent.mouseUp(area, { button: 1, clientX: 10, clientY: 20 });
    expect(lastInput().command).toEqual({ type: "mouse_button", button: "middle", action: "up" });
    fireEvent.mouseDown(area, { button: 0, clientX: 10, clientY: 20 });
    expect(lastInput().command).toEqual({ type: "mouse_button", button: "left", action: "down" });

    fireEvent.wheel(area, { deltaY: 120 });
    expect(lastInput().command).toEqual({ type: "mouse_wheel", delta: 120 });

    fireEvent.keyDown(area, { key: "a" });
    expect(lastInput().command).toEqual({ type: "key", key: "a", action: "down" });
    fireEvent.keyUp(area, { key: " " });
    expect(lastInput().command).toEqual({ type: "key", key: "Space", action: "up" });
    fireEvent.keyDown(area, { key: "ArrowLeft" });
    expect(lastInput().command).toEqual({ type: "key", key: "ArrowLeft", action: "down" });

    // Teclas nao mapeadas nao sao encaminhadas.
    const total = api.sendRemoteAssistanceInput.mock.calls.length;
    fireEvent.keyDown(area, { key: "Shift" });
    expect(api.sendRemoteAssistanceInput.mock.calls.length).toBe(total);

    // Menu de contexto e bloqueado enquanto o controle esta ativo.
    expect(fireEvent.contextMenu(area)).toBe(false);
  });

  it("falha ao enviar um comando mostra o erro", async () => {
    const area = await startControlSession();
    api.sendRemoteAssistanceInput.mockRejectedValue(new Error("Comando recusado"));
    await advance(200);
    await act(async () => {
      fireEvent.mouseMove(area, { clientX: 20, clientY: 30 });
    });
    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Comando recusado");
  });

  it("sem controle ativo nao encaminha nada e nao bloqueia o menu de contexto", async () => {
    server.session = { ...server.session, status: "active" };
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    await advance(1300);
    const area = screen.getByLabelText("Tela remota");
    expect(area).not.toHaveClass("control-active");
    expect(area).toHaveAttribute("tabindex", "-1");
    await advance(200);
    fireEvent.mouseMove(area, { clientX: 20, clientY: 30 });
    fireEvent.mouseDown(area, { button: 0 });
    fireEvent.mouseUp(area, { button: 0 });
    fireEvent.wheel(area, { deltaY: 10 });
    fireEvent.keyDown(area, { key: "a" });
    fireEvent.keyUp(area, { key: "a" });
    expect(fireEvent.contextMenu(area)).toBe(true);
    expect(api.sendRemoteAssistanceInput).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /controle/i })).not.toBeInTheDocument();
  });

  it("liberar controle e travar teclado e mouse locais", async () => {
    await startControlSession();
    const lock = screen.getByRole("button", { name: /Travar teclado/ });
    expect(lock).toHaveAttribute("title", "Travar teclado e mouse locais");
    await click(lock);
    expect(lastInput().command).toEqual({ type: "block_input", enabled: true });
    expect(screen.getByRole("button", { name: /Destravar teclado/ })).toHaveAttribute("title", "Destravar teclado e mouse locais");
    await click(screen.getByRole("button", { name: /Destravar teclado/ }));
    expect(lastInput().command).toEqual({ type: "block_input", enabled: false });

    await click(screen.getByRole("button", { name: /Travar teclado/ }));
    await click(screen.getByRole("button", { name: /Liberar controle/ }));
    expect(api.updateRemoteAssistanceControl).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      enabled: false
    });
    expect(screen.getByRole("button", { name: /Solicitar controle/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Destravar teclado|Travar teclado/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tela remota")).not.toHaveClass("control-active");
  });

  it("solicitar controle chama a API; falha mostra o erro", async () => {
    await startControlSession({ remoteControlEnabled: false });
    expect(screen.getByRole("dialog")).toHaveTextContent("Controle: inativo");
    await click(screen.getByRole("button", { name: /Solicitar controle/ }));
    expect(api.updateRemoteAssistanceControl).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));

    api.updateRemoteAssistanceControl.mockRejectedValue(new Error("Controle negado"));
    await click(screen.getByRole("button", { name: /Liberar controle/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Controle negado");
  });

  it("sem autorizacao local de controle o botao fica desabilitado com explicacao", async () => {
    await startControlSession({ remoteControlEnabled: false, controlConsentGranted: false });
    const button = screen.getByRole("button", { name: /Solicitar controle/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "O usuário não autorizou controle");
  });

  it("o controle exige a opcao de front, a permissao e a escolha do modo", async () => {
    vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "false");
    await renderAction(Action, { user: viewOnlyUser });
    await openDialog();
    expect(screen.queryByRole("radio", { name: /Solicitar mouse e teclado/ })).not.toBeInTheDocument();
  });
});

describe("maximizar", () => {
  it("alterna a classe do modal e o rotulo do botao", async () => {
    await startControlSession();
    const dialog = screen.getByRole("dialog");
    const button = screen.getByRole("button", { name: /Maximizar/ });
    expect(button).toHaveAttribute("title", "Maximizar tela");
    await click(button);
    expect(dialog).toHaveClass("remote-assistance-modal--maximized");
    expect(screen.getByRole("button", { name: /Restaurar/ })).toHaveAttribute("title", "Restaurar tamanho da janela");
    await click(screen.getByRole("button", { name: /Restaurar/ }));
    expect(dialog).not.toHaveClass("remote-assistance-modal--maximized");
  });
});

describe("chat com o usuário local", () => {
  async function startChatSession(props = {}) {
    server.session = { ...server.session, status: "active", monitors: [MONITORS[0]], selectedMonitorId: "m1" };
    server.frame = "AAAA";
    await renderAction(Action, props);
    await openDialog();
    await startNativeSession();
    await advance(1300);
  }

  it("lista mensagens vindas do polling de quadros, com autor e horario", async () => {
    server.chatMessages = [
      { id: "c1", sender: "technician", text: "Ola", createdAt: "2026-08-15T12:00:00.000Z" },
      { id: "c2", sender: "user", senderName: "Maria", text: "Oi, pode entrar", createdAt: "2026-08-15T12:01:00.000Z" },
      { id: "c3", sender: "user", text: "sem nome", createdAt: "data-invalida" }
    ];
    await startChatSession();
    const log = screen.getByRole("region", { name: "Chat com o usuário local" });
    expect(log).toHaveTextContent(/Você - \d{2}:\d{2}Ola/);
    expect(log).toHaveTextContent(/Maria - \d{2}:\d{2}Oi, pode entrar/);
    expect(log).toHaveTextContent("Usuário local - sem nome");
    expect(log.querySelector(".chat-technician")).not.toBeNull();
    expect(log.querySelector(".chat-user")).not.toBeNull();
    expect(log).not.toHaveTextContent("Nenhuma mensagem ainda.");
  });

  it("envia mensagem, limpa o rascunho e nao duplica quando o polling devolve a mesma", async () => {
    await startChatSession();
    const input = screen.getByLabelText("Mensagem de chat");
    const send = screen.getByTitle("Enviar mensagem");
    expect(send).toBeDisabled();
    fireEvent.change(input, { target: { value: "  preciso de acesso  " } });
    expect(send).toBeEnabled();
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    await advance(0);
    expect(api.sendRemoteAssistanceChatMessage).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      text: "preciso de acesso"
    });
    expect(input).toHaveValue("");
    expect(screen.getAllByText("preciso de acesso")).toHaveLength(1);

    // O servidor passa a devolver a mesma mensagem no polling.
    server.chatMessages = [
      { id: "msg-preciso de acesso", sender: "technician", text: "preciso de acesso", createdAt: "2026-08-15T12:00:00.000Z" }
    ];
    await advance(1100);
    expect(screen.getAllByText("preciso de acesso")).toHaveLength(1);
  });

  it("nao duplica a mensagem se ela ja esta na lista e ignora rascunho vazio", async () => {
    server.chatMessages = [{ id: "msg-oi", sender: "technician", text: "oi", createdAt: "2026-08-15T12:00:00.000Z" }];
    await startChatSession();
    const input = screen.getByLabelText("Mensagem de chat");
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    expect(api.sendRemoteAssistanceChatMessage).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "oi" } });
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    await advance(0);
    expect(screen.getAllByText("oi")).toHaveLength(1);
  });

  it("envio sem mensagem retornada apenas limpa o rascunho; erro mostra o alerta", async () => {
    await startChatSession();
    const input = screen.getByLabelText("Mensagem de chat");
    api.sendRemoteAssistanceChatMessage.mockResolvedValueOnce({});
    fireEvent.change(input, { target: { value: "x" } });
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    await advance(0);
    expect(input).toHaveValue("");

    api.sendRemoteAssistanceChatMessage.mockRejectedValueOnce(new Error("Chat indisponivel"));
    fireEvent.change(input, { target: { value: "y" } });
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    await advance(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Chat indisponivel");
    expect(input).toHaveValue("y");
  });

  it("desabilita a digitacao enquanto o envio esta em andamento", async () => {
    await startChatSession();
    api.sendRemoteAssistanceChatMessage.mockReturnValue(new Promise(() => {}));
    const input = screen.getByLabelText("Mensagem de chat");
    fireEvent.change(input, { target: { value: "x" } });
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    expect(input).toBeDisabled();
    // Reenvio durante o envio e ignorado.
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });
    expect(api.sendRemoteAssistanceChatMessage).toHaveBeenCalledTimes(1);
  });

  it("antes da sessao ficar ativa a digitacao fica desabilitada", async () => {
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    expect(screen.getByLabelText("Mensagem de chat")).toBeDisabled();
    expect(screen.getByTitle("Enviar mensagem")).toBeDisabled();
  });

  it("abre e fecha o painel de chat", async () => {
    await startChatSession();
    const toggle = screen.getByRole("button", { name: /Fechar chat/ });
    expect(toggle).toHaveAttribute("title", "Fechar o chat com o usuário local");
    await click(toggle);
    expect(screen.queryByRole("region", { name: "Chat com o usuário local" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir chat/ })).toHaveAttribute("title", "Abrir o chat com o usuário local");
    await click(screen.getByRole("button", { name: /Abrir chat/ }));
    expect(screen.getByRole("region", { name: "Chat com o usuário local" })).toBeInTheDocument();
  });

  it("sem permissao de chat mostra apenas o aviso", async () => {
    await startChatSession({ user: viewOnlyUser });
    expect(screen.queryByLabelText("Mensagem de chat")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Você não tem permissão para enviar mensagens.");
  });
});
