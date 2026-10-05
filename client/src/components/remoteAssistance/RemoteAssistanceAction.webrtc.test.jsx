import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { advance, openDialog, renderAction, startNativeSession, wireApi } from "./test/fixtures.jsx";

// Caracterizacao do transporte WebRTC (visualizador): oferta/resposta SDP unica
// via polling, coleta de ICE completa antes de ofertar e limpeza da conexao.

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());

const implementationPath = import.meta.env.VITE_REMOTE_IMPL || "./RemoteAssistanceAction.jsx";
const { default: Action } = await import(/* @vite-ignore */ implementationPath);

class FakePeerConnection {
  static instances = [];
  static gatheringState = "complete";

  constructor(config) {
    this.config = config;
    this.iceGatheringState = FakePeerConnection.gatheringState;
    this.signalingState = "stable";
    this.listeners = new Map();
    this.addTransceiver = vi.fn();
    this.close = vi.fn();
    this.setRemoteDescription = vi.fn(async () => {
      this.signalingState = "stable";
    });
    FakePeerConnection.instances.push(this);
  }

  async createOffer() {
    return { type: "offer", sdp: "offer-sdp" };
  }

  async setLocalDescription(description) {
    this.localDescription = description;
    this.signalingState = "have-local-offer";
  }

  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }

  removeEventListener(name) {
    this.listeners.delete(name);
  }

  finishGathering() {
    this.iceGatheringState = "complete";
    this.listeners.get("icegatheringstatechange")?.();
  }
}

let server;

async function startWebrtc() {
  server.session = { ...server.session, status: "active", transport: "webrtc", monitors: [] };
  const view = await renderAction(Action);
  await openDialog();
  await startNativeSession();
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_ENABLE_REMOTE_ASSISTANCE", "true");
  vi.stubEnv("VITE_ENABLE_REMOTE_CONTROL", "false");
  vi.clearAllMocks();
  FakePeerConnection.instances = [];
  FakePeerConnection.gatheringState = "complete";
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  server = wireApi(api, { config: { iceServers: [{ urls: "stun:stun.example.org" }] } });
  api.sendRemoteAssistanceWebrtcOffer.mockResolvedValue({});
  api.fetchRemoteAssistanceWebrtcAnswer.mockResolvedValue({ answer: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("transporte WebRTC", () => {
  it("negocia: oferta com o SDP completo, resposta por polling e video ao receber a trilha", async () => {
    await startWebrtc();
    const dialog = screen.getByRole("dialog");
    expect(FakePeerConnection.instances).toHaveLength(1);
    const peer = FakePeerConnection.instances[0];
    expect(peer.config).toEqual({ iceServers: [{ urls: "stun:stun.example.org" }] });
    expect(peer.addTransceiver).toHaveBeenCalledWith("video", { direction: "recvonly" });
    expect(api.sendRemoteAssistanceWebrtcOffer).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1",
      sdp: "offer-sdp"
    });
    expect(dialog).toHaveTextContent("Transporte: WebRTC");
    expect(dialog).toHaveTextContent("Negociando conexao WebRTC com o agente...");
    expect(dialog.querySelector("video")).toHaveStyle({ display: "none" });
    expect(dialog.querySelector("img")).toBeNull();

    // Ainda sem resposta: continua consultando.
    await advance(1000);
    expect(api.fetchRemoteAssistanceWebrtcAnswer).toHaveBeenCalledWith({
      token: "tok-1",
      sessionId: "sess-1",
      viewerToken: "viewer-1"
    });
    expect(peer.setRemoteDescription).not.toHaveBeenCalled();

    api.fetchRemoteAssistanceWebrtcAnswer.mockResolvedValue({ answer: "answer-sdp" });
    await advance(1000);
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "answer-sdp" });
    const calls = api.fetchRemoteAssistanceWebrtcAnswer.mock.calls.length;
    await advance(3000);
    expect(api.fetchRemoteAssistanceWebrtcAnswer.mock.calls.length).toBe(calls);

    // Trilha de video chega.
    const stream = { id: "stream-1" };
    await act(async () => {
      peer.ontrack({ streams: [stream] });
    });
    const video = dialog.querySelector("video");
    expect(video).toHaveStyle({ display: "block" });
    expect(video.srcObject).toBe(stream);
    expect(video.muted).toBe(true);
    expect(dialog).not.toHaveTextContent("Negociando conexao WebRTC");
  });

  it("espera a coleta de candidatos ICE terminar antes de enviar a oferta", async () => {
    FakePeerConnection.gatheringState = "gathering";
    await startWebrtc();
    expect(api.sendRemoteAssistanceWebrtcOffer).not.toHaveBeenCalled();
    await act(async () => {
      FakePeerConnection.instances[0].finishGathering();
    });
    await advance(0);
    expect(api.sendRemoteAssistanceWebrtcOffer).toHaveBeenCalledTimes(1);
  });

  it("segue com a oferta apos o limite de espera da coleta de ICE", async () => {
    FakePeerConnection.gatheringState = "gathering";
    await startWebrtc();
    await advance(8100);
    expect(api.sendRemoteAssistanceWebrtcOffer).toHaveBeenCalledTimes(1);
  });

  it("falha ao enviar a oferta mostra o erro", async () => {
    api.sendRemoteAssistanceWebrtcOffer.mockRejectedValue(new Error("Oferta recusada"));
    await startWebrtc();
    expect(screen.getByRole("alert")).toHaveTextContent("Oferta recusada");
  });

  it("falha ao buscar a resposta mostra o erro", async () => {
    api.fetchRemoteAssistanceWebrtcAnswer.mockRejectedValue(new Error("Resposta indisponivel"));
    await startWebrtc();
    await advance(1000);
    expect(screen.getByRole("alert")).toHaveTextContent("Resposta indisponivel");
  });

  it("usa lista vazia de servidores ICE quando a configuracao nao traz nenhum", async () => {
    api.fetchRemoteAssistanceConfig.mockResolvedValue({ enabled: true });
    await startWebrtc();
    expect(FakePeerConnection.instances[0].config).toEqual({ iceServers: [] });
  });

  it("pausar fecha a conexao e retomar abre uma nova", async () => {
    await startWebrtc();
    const first = FakePeerConnection.instances[0];
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    });
    await advance(0);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(first.ontrack).toBeNull();
    expect(FakePeerConnection.instances).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Retomar/ }));
    });
    await advance(0);
    expect(FakePeerConnection.instances).toHaveLength(2);
  });

  it("encerrar e desmontar fecham a conexao", async () => {
    const { unmount } = await startWebrtc();
    const peer = FakePeerConnection.instances[0];
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    });
    await advance(0);
    expect(peer.close).toHaveBeenCalled();
    unmount();
  });

  it("nao negocia em sessoes de outro transporte", async () => {
    server.session = { ...server.session, status: "active", transport: "snapshot" };
    await renderAction(Action);
    await openDialog();
    await startNativeSession();
    expect(FakePeerConnection.instances).toHaveLength(0);
  });
});
