import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../api.js";
import { buildTopologyLinkPayload, clusterDevices, linkConnectsNodes, topologyNodeKey } from "./networkTopologyConnections.js";
import useTopologyLinkCreation from "./useTopologyLinkCreation.js";

vi.mock("../../../api.js", () => ({ createNetworkTopologyLink: vi.fn(), fetchNetworkTopologyMap: vi.fn() }));
const first = { id: "preview-a", nodeType: "asset", assetId: "a", preview: true };
const second = { id: "preview-b", nodeType: "asset", assetId: "b", preview: true };
const group = { id: "preview-group-a", nodeType: "group", refId: "a", preview: true };
const savedLink = { id: "link-1", ...buildTopologyLinkPayload(first, second), type: "ethernet" };

describe("identidade das conexões", () => {
  it("usa IDs reais e separa tipos com o mesmo ID", () => {
    expect(topologyNodeKey(first)).toBe("asset:a");
    expect(topologyNodeKey(group)).toBe("group:a");
    expect(buildTopologyLinkPayload(second, first)).toEqual({ sourceType: "asset", sourceAssetId: "a", targetType: "asset", targetAssetId: "b" });
    expect(linkConnectsNodes(savedLink, second, first)).toBe(true);
    expect(linkConnectsNodes(savedLink, group, second)).toBe(false);
  });
  it("agrega máquinas de um grupo sem duplicar", () => {
    const a = { id: "a", name: "Servidor A" };
    const b = { id: "b", name: "Servidor B" };
    expect(clusterDevices({ segments: [{ devices: [b, a] }, { devices: [a] }] }, "group")).toEqual([a, b]);
    expect(clusterDevices(null, "group")).toEqual([]);
  });
});

describe("criação manual de conexões", () => {
  let options;
  beforeEach(() => {
    vi.clearAllMocks();
    api.createNetworkTopologyLink.mockResolvedValue({ link: savedLink });
    options = { token: "test-token", mapId: "map-1", scopeKey: "scope-1", enabled: true, nodes: [first, second, group], links: [], onCreated: vi.fn(), notify: vi.fn() };
  });
  function connect(result, a = first, b = second) {
    act(() => result.current.start());
    act(() => result.current.activate(a));
    act(() => result.current.activate(b));
  }
  it("salva uma única linha entre prévias usando IDs reais", async () => {
    const { result } = renderHook(() => useTopologyLinkCreation(options));
    connect(result);
    await waitFor(() => expect(options.onCreated).toHaveBeenCalledExactlyOnceWith("map-1", savedLink, true));
    expect(api.createNetworkTopologyLink).toHaveBeenCalledExactlyOnceWith("test-token", "map-1", buildTopologyLinkPayload(first, second));
    expect(result.current.active).toBe(false);
    expect(result.current.busy).toBe(false);
  });
  it("bloqueia self-link e tipos diferentes sem perder a origem", () => {
    const { result } = renderHook(() => useTopologyLinkCreation(options));
    connect(result, first, first);
    expect(result.current.error).toMatch(/outro item/);
    act(() => result.current.activate(group));
    expect(result.current.error).toMatch(/mesmo tipo/);
    expect(result.current.sourceNodeId).toBe(first.id);
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  });
  it("cancelar antes do destino não grava nada", () => {
    const { result } = renderHook(() => useTopologyLinkCreation(options));
    act(() => result.current.start(first));
    act(() => result.current.reset());
    act(() => result.current.activate(second));
    expect(result.current.active).toBe(false);
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  });
  it("bloqueia um segundo POST enquanto o primeiro está pendente", async () => {
    let finish;
    api.createNetworkTopologyLink.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useTopologyLinkCreation(options));
    connect(result);
    act(() => result.current.activate(second));
    act(() => result.current.toggle());
    expect(api.createNetworkTopologyLink).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => { finish({ link: savedLink }); });
    expect(options.onCreated).toHaveBeenCalledTimes(1);
  });
  it("não entrega o retorno pendente ao mudar de mapa", async () => {
    let finish;
    api.createNetworkTopologyLink.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result, rerender } = renderHook((props) => useTopologyLinkCreation(props), { initialProps: options });
    connect(result);
    rerender({ ...options, mapId: "map-2", scopeKey: "scope-2" });
    await act(async () => { finish({ link: savedLink }); });
    expect(options.onCreated).not.toHaveBeenCalled();
    expect(options.notify).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
  it("reconcilia 409 pelo mesmo mapa sem repetir POST", async () => {
    api.createNetworkTopologyLink.mockRejectedValue(Object.assign(new Error("Conexão já existe"), { statusCode: 409 }));
    api.fetchNetworkTopologyMap.mockResolvedValue({ links: [savedLink] });
    const { result } = renderHook(() => useTopologyLinkCreation(options));
    connect(result);
    await waitFor(() => expect(options.onCreated).toHaveBeenCalledExactlyOnceWith("map-1", savedLink, false));
    expect(api.fetchNetworkTopologyMap).toHaveBeenCalledExactlyOnceWith("test-token", "map-1");
    expect(api.createNetworkTopologyLink).toHaveBeenCalledTimes(1);
  });
  it("seleciona vínculo existente em sentido inverso sem duplicar", () => {
    const { result } = renderHook(() => useTopologyLinkCreation({ ...options, links: [savedLink] }));
    connect(result, second, first);
    expect(options.onCreated).toHaveBeenCalledExactlyOnceWith("map-1", savedLink, false);
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  });
  it("sem permissão não inicia nem grava", () => {
    const { result } = renderHook(() => useTopologyLinkCreation({ ...options, enabled: false }));
    connect(result);
    expect(result.current.active).toBe(false);
    expect(api.createNetworkTopologyLink).not.toHaveBeenCalled();
  });
});
