import { afterEach, describe, expect, it, vi } from "vitest";
import { formatChatTime, formatDateTime } from "./utils/format.js";
import { toFrameSrc } from "./utils/frame.js";
import { isForwardableKey, mouseButtonName, normalizeKey, pointerPosition } from "./utils/input.js";
import { notifyResult } from "./utils/notify.js";
import { getMonitorState, getSessionFlags, getUnavailableTitle, isControlActive } from "./utils/viewState.js";
import { waitForIceGatheringComplete } from "./utils/webrtc.js";

describe("format", () => {
  it("formatDateTime trata vazio e invalido", () => {
    expect(formatDateTime(null)).toBe("Nao informado");
    expect(formatDateTime("nao-e-data")).toBe("Nao informado");
    expect(formatDateTime("2026-08-15T12:30:00.000Z")).toMatch(/^15\/08/);
  });

  it("formatChatTime devolve vazio para data invalida", () => {
    expect(formatChatTime("x")).toBe("");
    expect(formatChatTime("2026-08-15T12:30:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("toFrameSrc", () => {
  it("mantem data URL e prefixa base64 puro", () => {
    expect(toFrameSrc("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    expect(toFrameSrc("AA")).toBe("data:image/jpeg;base64,AA");
  });
});

describe("input", () => {
  it("normaliza a posicao do ponteiro para 0..1", () => {
    const bounds = { left: 10, top: 20, width: 200, height: 100 };
    expect(pointerPosition(bounds, 110, 70)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointerPosition(bounds, -5, 500)).toEqual({ x: 0, y: 1 });
  });

  it("traduz botoes e teclas", () => {
    expect(mouseButtonName(0)).toBe("left");
    expect(mouseButtonName(1)).toBe("middle");
    expect(mouseButtonName(2)).toBe("right");
    expect(normalizeKey(" ")).toBe("Space");
    expect(normalizeKey("a")).toBe("a");
    expect(isForwardableKey("a")).toBe(true);
    expect(isForwardableKey("Enter")).toBe(true);
    expect(isForwardableKey("Shift")).toBe(false);
    expect(isForwardableKey("F5")).toBe(false);
  });
});

describe("notifyResult", () => {
  it("so chama notify quando e funcao", () => {
    const notify = vi.fn();
    notifyResult(notify, "ok");
    notifyResult(notify, "erro", "error");
    notifyResult(undefined, "ignorado");
    expect(notify.mock.calls).toEqual([["ok", "ok"], ["erro", "error"]]);
  });
});

describe("viewState", () => {
  it("escolhe o titulo de indisponibilidade na ordem de prioridade", () => {
    const base = { frontendEnabled: true, canView: true, canStart: true, eligible: true, config: null };
    expect(getUnavailableTitle({ ...base, frontendEnabled: false })).toBe("Atendimento remoto nao habilitado");
    expect(getUnavailableTitle({ ...base, canStart: false })).toBe("Sem permissao para atendimento remoto");
    expect(getUnavailableTitle({ ...base, eligible: false })).toBe("Agente offline ou sem contato recente");
    expect(getUnavailableTitle({ ...base, config: { enabled: false } })).toBe("Atendimento remoto indisponivel");
    expect(getUnavailableTitle(base)).toBe("Verificando atendimento remoto");
  });

  it("seleciona monitor e proporcao da tela", () => {
    expect(getMonitorState(null)).toEqual({ monitors: [], selectedMonitor: null, screenAspectRatio: "16 / 9" });
    const monitors = [{ id: "a", width: 800, height: 600 }, { id: "b", width: 1280, height: 720 }];
    expect(getMonitorState({ monitors }).selectedMonitor.id).toBe("a");
    const second = getMonitorState({ monitors, selectedMonitorId: "b" });
    expect(second.selectedMonitor.id).toBe("b");
    expect(second.screenAspectRatio).toBe("1280 / 720");
    expect(getMonitorState({ monitors, selectedMonitorId: "zzz" }).selectedMonitor.id).toBe("a");
  });

  it("controle so fica ativo com todas as condicoes", () => {
    const session = { status: "active", remoteControlEnabled: true, controlConsentGranted: true };
    const all = { frontendControlEnabled: true, session, requestedMode: "control" };
    expect(isControlActive(all)).toBe(true);
    expect(isControlActive({ ...all, frontendControlEnabled: false })).toBe(false);
    expect(isControlActive({ ...all, requestedMode: "view" })).toBe(false);
    expect(isControlActive({ ...all, session: { ...session, controlConsentGranted: false } })).toBe(false);
    expect(isControlActive({ ...all, session: null })).toBe(false);
  });

  it("deriva flags de sessao: terminal, quadro atrasado e reconexao", () => {
    const active = { id: "s", status: "active", transport: "webrtc" };
    expect(getSessionFlags({ session: active, metrics: { frameAgeMs: 9000 }, viewerPollMs: 1000, error: "" })).toMatchObject({
      terminal: false,
      paused: false,
      isWebrtc: true,
      isRustdesk: false,
      connectionState: "active",
      frameStale: true,
      canReconnect: false
    });
    expect(getSessionFlags({ session: { ...active, paused: true }, metrics: { frameAgeMs: 9000 }, viewerPollMs: 1000 }).frameStale).toBe(false);
    expect(getSessionFlags({ session: active, metrics: null, viewerPollMs: 1000, error: "falha" }).canReconnect).toBe(true);
    expect(getSessionFlags({ session: { ...active, connectionState: "agent_offline" } }).canReconnect).toBe(true);
    expect(getSessionFlags({ session: { ...active, status: "ended" }, error: "x" })).toMatchObject({ terminal: true, canReconnect: false });
    expect(getSessionFlags({ session: null })).toMatchObject({ terminal: false, isRustdesk: false, canReconnect: false });
  });
});

describe("waitForIceGatheringComplete", () => {
  afterEach(() => vi.useRealTimers());

  function fakePeer(state) {
    const listeners = new Set();
    return {
      iceGatheringState: state,
      addEventListener: (_name, handler) => listeners.add(handler),
      removeEventListener: (_name, handler) => listeners.delete(handler),
      listeners,
      finish() {
        this.iceGatheringState = "complete";
        [...listeners].forEach((handler) => handler());
      }
    };
  }

  it("resolve na hora quando a coleta ja terminou", async () => {
    await expect(waitForIceGatheringComplete(fakePeer("complete"))).resolves.toBeUndefined();
  });

  it("resolve quando o estado muda para complete e remove o listener", async () => {
    const peer = fakePeer("gathering");
    const promise = waitForIceGatheringComplete(peer);
    peer.finish();
    await expect(promise).resolves.toBeUndefined();
    expect(peer.listeners.size).toBe(0);
  });

  it("ignora mudancas intermediarias e resolve no limite de tempo", async () => {
    vi.useFakeTimers();
    const peer = fakePeer("gathering");
    const promise = waitForIceGatheringComplete(peer, 500);
    [...peer.listeners].forEach((handler) => handler());
    expect(peer.listeners.size).toBe(1);
    await vi.advanceTimersByTimeAsync(600);
    await expect(promise).resolves.toBeUndefined();
    expect(peer.listeners.size).toBe(0);
  });
});
