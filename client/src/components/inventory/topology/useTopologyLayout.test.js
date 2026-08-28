import { useCallback, useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateNetworkTopologyAutoLayout, updateNetworkTopologyNode } from "../../../api.js";
import { ensureTopologyNode, saveTopologyPositions } from "./networkTopologyPersistence.js";
import { resolveTopologyDisplayNodes } from "./networkTopologyProjection.js";
import useTopologyLayout from "./useTopologyLayout.js";

vi.mock("../../../api.js", () => ({
  generateNetworkTopologyAutoLayout: vi.fn(),
  updateNetworkTopologyNode: vi.fn()
}));
vi.mock("./networkTopologyPersistence.js", () => ({
  ensureTopologyNode: vi.fn(),
  saveTopologyPositions: vi.fn()
}));

const MAP_ID = "layout-map-one";

function inventoryNode(nodeType, reference, overrides = {}) {
  return {
    id: "inventory-default:" + nodeType + ":" + reference,
    nodeType,
    assetId: nodeType === "asset" ? reference : null,
    refId: nodeType === "asset" ? null : reference,
    x: 800, y: 500, pinned: false, automatic: true,
    ...overrides
  };
}

const ASSET = Object.freeze(inventoryNode("asset", "shared", { labelOverride: "Financeiro" }));
const GROUP = Object.freeze(inventoryNode("group", "shared", { x: 500, y: 400 }));
const SECOND_ASSET = Object.freeze(inventoryNode("asset", "second", { x: 1100, y: 500 }));
const LINKS = Object.freeze([{ id: "existing-link", sourceAssetId: "shared", targetAssetId: "second", label: "Backup" }]);
const DEVICES = new Map([
  ["shared", { id: "shared", assetType: "server", status: "online" }],
  ["second", { id: "second", type: "nas", status: "offline" }]
]);

function persistedNode(node, overrides = {}) {
  return {
    id: "saved:" + node.nodeType + ":" + (node.assetId || node.refId),
    mapId: MAP_ID,
    nodeType: node.nodeType, assetId: node.assetId, refId: node.refId,
    x: node.x, y: node.y, pinned: Boolean(node.pinned),
    labelOverride: node.labelOverride || null,
    ...overrides
  };
}

function makeBundle(nodes = [], overrides = {}) {
  return { map: { id: MAP_ID, name: "Mapa de teste" }, nodes, links: LINKS, ...overrides };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// The harness models only the View's bundle and selection handoff. The real
// persistence helper's validation, reconciliation and API batching have a
// separate suite; these mocks expose its callback/cancellation contract.
function renderLayout(overrides = {}) {
  const { initialBundle = makeBundle(), initialSelection = ASSET.id, ...options } = overrides;
  const props = {
    token: "layout-test-session", mapId: MAP_ID, scopeKey: "scope-one", enabled: true,
    inventoryNodes: [ASSET, GROUP], devicesById: DEVICES,
    ...options
  };
  const notify = vi.fn();
  const onAutoLayout = vi.fn();
  const onMaterialized = vi.fn();
  const onMerge = vi.fn();
  const rendered = renderHook((current) => {
    const [bundle, updateBundle] = useState(initialBundle);
    const [selection, setSelection] = useState(initialSelection);
    const setBundle = useCallback((updater) => {
      onMerge();
      updateBundle(updater);
    }, [onMerge]);
    const materialized = useCallback((saved, original) => {
      onMaterialized(saved, original);
      setSelection((selected) => selected === original.id ? saved.id : selected);
    }, [onMaterialized]);
    const nodes = resolveTopologyDisplayNodes(bundle.nodes, current.inventoryNodes);
    const layout = useTopologyLayout({
      token: current.token, mapId: current.mapId, scopeKey: current.scopeKey,
      nodes, devicesById: current.devicesById, enabled: current.enabled,
      setBundle, onMaterialized: materialized, onAutoLayout, notify
    });
    return { ...layout, bundle, selection, nodes, setLocalBundle: updateBundle, setLocalSelection: setSelection };
  }, { initialProps: props });
  return { ...rendered, props, notify, onAutoLayout, onMaterialized, onMerge };
}

function drag(result, node = ASSET, x = 950, y = 620) {
  act(() => result.current.onNodeDrag(node.id, x, y));
}

function startOperation(result, operation) {
  let request;
  act(() => {
    if (operation === "save") request = result.current.saveLayout();
    else if (operation === "generate") request = result.current.generateAutoLayout();
    else request = result.current.togglePinned(ASSET);
  });
  return request;
}

function expectNoOperations() {
  expect(saveTopologyPositions).not.toHaveBeenCalled();
  expect(ensureTopologyNode).not.toHaveBeenCalled();
  expect(generateNetworkTopologyAutoLayout).not.toHaveBeenCalled();
  expect(updateNetworkTopologyNode).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  ensureTopologyNode.mockImplementation(async ({ node, isCurrent, onMaterialized }) => {
    if (!isCurrent()) return null;
    if (!node.automatic) return node;
    const saved = persistedNode(node);
    onMaterialized?.(saved, node);
    return saved;
  });
  saveTopologyPositions.mockImplementation(async ({ changes, isCurrent, onMaterialized }) => {
    if (!isCurrent()) return null;
    return {
      nodes: changes.map(({ node, x, y }) => {
        const saved = node.automatic ? persistedNode(node) : node;
        if (node.automatic) onMaterialized?.(saved, node);
        return { ...saved, x, y };
      })
    };
  });
  generateNetworkTopologyAutoLayout.mockResolvedValue({ nodes: [] });
  updateNetworkTopologyNode.mockImplementation(async (_token, id, payload) => ({
    node: { ...persistedNode(ASSET), id, ...payload }
  }));
});

describe("useTopologyLayout", () => {
  it("não materializa ou salva nada por montar e atualizar o inventário", () => {
    const { result, props, rerender } = renderLayout();
    rerender({ ...props, inventoryNodes: [...props.inventoryNodes, SECOND_ASSET] });
    expect(result.current.dirtyPositions.size).toBe(0);
    expect(result.current.saving).toBe(false);
    expect(result.current.generatingLayout).toBe(false);
    expectNoOperations();
  });

  it.each([{ enabled: false }, { mapId: null }])("não escreve sem contexto autorizado: %j", async (options) => {
    const { result } = renderLayout(options);
    drag(result);
    await act(async () => {
      await result.current.saveLayout();
      await result.current.generateAutoLayout();
      await result.current.togglePinned(ASSET);
    });
    expectNoOperations();
  });

  it("guarda dirty por tipo e referência, ignora valores inválidos e remove só o item revertido", () => {
    const { result } = renderLayout();
    drag(result, ASSET, 900, 600);
    drag(result, GROUP, 450, 350);
    expect([...result.current.dirtyPositions]).toEqual([
      ["asset:shared", { x: 900, y: 600 }],
      ["group:shared", { x: 450, y: 350 }]
    ]);
    drag(result, ASSET, NaN, 100);
    drag(result, ASSET, 100, Infinity);
    drag(result, { id: "missing" }, 20, 30);
    expect(result.current.dirtyPositions.get("asset:shared")).toEqual({ x: 900, y: 600 });
    drag(result, ASSET, ASSET.x, ASSET.y);
    expect([...result.current.dirtyPositions]).toEqual([["group:shared", { x: 450, y: 350 }]]);
    act(() => result.current.resetLayout());
    expect(result.current.dirtyPositions.size).toBe(0);
    expectNoOperations();
  });

  it("salva por identidade tipada, entrega bases intactas e preserva conexões e seleção", async () => {
    const extra = persistedNode(SECOND_ASSET, { labelOverride: "Preservado", pinned: true });
    const { result, onMaterialized, notify } = renderLayout({ initialBundle: makeBundle([extra]) });
    drag(result, ASSET, 950, 620);
    drag(result, GROUP, 450, 350);
    await act(async () => { await result.current.saveLayout(); });
    expect(saveTopologyPositions).toHaveBeenCalledOnce();
    expect(saveTopologyPositions.mock.calls[0][0].changes).toEqual([
      { node: ASSET, x: 950, y: 620 }, { node: GROUP, x: 450, y: 350 }
    ]);
    expect(result.current.dirtyPositions.size).toBe(0);
    expect(result.current.bundle.nodes).toContainEqual(extra);
    expect(result.current.bundle.nodes).toContainEqual({ ...persistedNode(ASSET), x: 950, y: 620 });
    expect(result.current.bundle.nodes).toContainEqual({ ...persistedNode(GROUP), x: 450, y: 350 });
    expect(result.current.bundle.links).toBe(LINKS);
    expect(result.current.selection).toBe(persistedNode(ASSET).id);
    expect(onMaterialized).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith("success", "Layout do mapa de rede salvo.");
  });

  it("preserva dirty e materializações confirmadas quando o PATCH falha e permite repetir", async () => {
    const saved = persistedNode(ASSET);
    saveTopologyPositions.mockImplementationOnce(async ({ onMaterialized }) => {
      onMaterialized(saved, ASSET);
      throw new Error("Falha ao salvar posições");
    });
    const { result, notify } = renderLayout();
    drag(result);
    await act(async () => { await result.current.saveLayout(); });
    expect(result.current.bundle.nodes).toEqual([saved]);
    expect(result.current.dirtyPositions.get("asset:shared")).toEqual({ x: 950, y: 620 });
    expect(result.current.selection).toBe(saved.id);
    expect(result.current.saving).toBe(false);
    expect(notify).toHaveBeenCalledWith("error", "Falha ao salvar posições");
    await act(async () => { await result.current.saveLayout(); });
    expect(saveTopologyPositions.mock.calls[1][0].changes).toEqual([{ node: saved, x: 950, y: 620 }]);
    expect(result.current.bundle.nodes).toEqual([{ ...saved, x: 950, y: 620 }]);
    expect(result.current.bundle.links).toBe(LINKS);
    expect(result.current.dirtyPositions.size).toBe(0);
  });

  it("impede ações concorrentes e alterações de posição durante um salvamento", async () => {
    const pending = deferred();
    saveTopologyPositions.mockReturnValueOnce(pending.promise);
    const { result } = renderLayout();
    drag(result);
    const request = startOperation(result, "save");
    expect(result.current.saving).toBe(true);
    drag(result, ASSET, 1200, 800);
    act(() => result.current.resetLayout());
    await act(async () => {
      await result.current.saveLayout();
      await result.current.generateAutoLayout();
      await result.current.togglePinned(ASSET);
    });
    expect(saveTopologyPositions).toHaveBeenCalledOnce();
    expect(ensureTopologyNode).not.toHaveBeenCalled();
    expect(generateNetworkTopologyAutoLayout).not.toHaveBeenCalled();
    expect(updateNetworkTopologyNode).not.toHaveBeenCalled();
    expect(result.current.dirtyPositions.get("asset:shared")).toEqual({ x: 950, y: 620 });
    await act(async () => { pending.resolve({ nodes: [{ ...persistedNode(ASSET), x: 950, y: 620 }] }); await request; });
    expect(result.current.saving).toBe(false);
    expect(result.current.dirtyPositions.size).toBe(0);
  });

  it.each([
    { scopeKey: "scope-two" }, { token: "another-session" }, { mapId: "other-map" }, { enabled: false }
  ])("ignora conclusão de save após mudar o contexto: %j", async (change) => {
    const pending = deferred();
    saveTopologyPositions.mockReturnValueOnce(pending.promise);
    const { result, props, rerender, onMerge, notify } = renderLayout();
    drag(result);
    const request = startOperation(result, "save");
    rerender({ ...props, ...change });
    expect(result.current.dirtyPositions.size).toBe(0);
    expect(result.current.saving).toBe(false);
    await act(async () => { pending.resolve({ nodes: [persistedNode(ASSET)] }); await request; });
    expect(onMerge).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(result.current.bundle.nodes).toEqual([]);
  });

  it.each(["generate", "pin"])("não continua %s quando muda o mapa durante a materialização", async (operation) => {
    const pending = deferred();
    ensureTopologyNode.mockReturnValueOnce(pending.promise);
    const { result, props, rerender, onMerge, notify } = renderLayout();
    const request = startOperation(result, operation);
    rerender({ ...props, mapId: "other-map", scopeKey: "scope-two" });
    await act(async () => { pending.resolve(persistedNode(ASSET)); await request; });
    expect(generateNetworkTopologyAutoLayout).not.toHaveBeenCalled();
    expect(updateNetworkTopologyNode).not.toHaveBeenCalled();
    expect(onMerge).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
    expect(result.current.generatingLayout).toBe(false);
  });

  it.each(["generate", "pin"])("ignora resposta de %s após navegar para outro mapa", async (operation) => {
    const pending = deferred();
    const write = operation === "generate" ? generateNetworkTopologyAutoLayout : updateNetworkTopologyNode;
    write.mockReturnValueOnce(pending.promise);
    const { result, props, rerender, onMerge, notify, onAutoLayout } = renderLayout();
    const request = startOperation(result, operation);
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    const newBundle = makeBundle([], { map: { id: "other-map" } });
    act(() => result.current.setLocalBundle(newBundle));
    rerender({ ...props, mapId: "other-map", scopeKey: "scope-two" });
    const mergesBeforeResponse = onMerge.mock.calls.length;
    await act(async () => {
      pending.resolve(operation === "generate" ? { nodes: [persistedNode(ASSET)] } : { node: persistedNode(ASSET) });
      await request;
    });
    expect(result.current.bundle).toEqual(newBundle);
    expect(onMerge).toHaveBeenCalledTimes(mergesBeforeResponse);
    expect(notify).not.toHaveBeenCalled();
    expect(onAutoLayout).not.toHaveBeenCalled();
  });

  it("não notifica um erro atrasado de uma sessão anterior", async () => {
    const pending = deferred();
    saveTopologyPositions.mockReturnValueOnce(pending.promise);
    const { result, props, rerender, notify } = renderLayout();
    drag(result);
    const request = startOperation(result, "save");
    rerender({ ...props, token: "another-session" });
    await act(async () => { pending.reject(new Error("Resposta atrasada")); await request; });
    expect(notify).not.toHaveBeenCalled();
  });

  it("gera o layout com todos os itens elegíveis e preserva metadados e conexões", async () => {
    const pinned = persistedNode(ASSET, { pinned: true, labelOverride: "Servidor principal" });
    const placed = [pinned, persistedNode(GROUP, { x: 300, y: 700 }), persistedNode(SECOND_ASSET, { x: 1100, y: 700 })];
    generateNetworkTopologyAutoLayout.mockResolvedValue({ nodes: placed });
    const { result, onAutoLayout } = renderLayout({
      initialBundle: makeBundle([pinned]), inventoryNodes: [ASSET, GROUP, SECOND_ASSET]
    });
    await act(async () => { await result.current.generateAutoLayout(); });
    expect(ensureTopologyNode).toHaveBeenCalledTimes(3);
    expect(ensureTopologyNode.mock.calls.map(([args]) => args.node.id)).toEqual([pinned.id, GROUP.id, SECOND_ASSET.id]);
    expect(generateNetworkTopologyAutoLayout.mock.calls[0][1]).toBe(MAP_ID);
    expect(generateNetworkTopologyAutoLayout.mock.calls[0][2].map((hint) => hint.assetId)).toEqual(["shared", "second"]);
    expect(result.current.bundle.nodes).toEqual(placed);
    expect(result.current.bundle.links).toBe(LINKS);
    expect(result.current.generatingLayout).toBe(false);
    expect(onAutoLayout).toHaveBeenCalledOnce();
  });

  it("fixa um item automático pela posição-base sem descartar o arraste pendente", async () => {
    const { result } = renderLayout();
    drag(result);
    await act(async () => { await result.current.togglePinned({ ...ASSET, x: 950, y: 620 }); });
    expect(ensureTopologyNode.mock.calls[0][0].node).toEqual(ASSET);
    expect(updateNetworkTopologyNode).toHaveBeenCalledExactlyOnceWith(
      "layout-test-session", persistedNode(ASSET).id, { pinned: true }
    );
    expect(result.current.bundle.nodes[0]).toMatchObject({ x: 800, y: 500, pinned: true, labelOverride: "Financeiro" });
    expect(result.current.dirtyPositions.get("asset:shared")).toEqual({ x: 950, y: 620 });
    expect(result.current.selection).toBe(persistedNode(ASSET).id);
    expect(result.current.bundle.links).toBe(LINKS);
    expect(result.current.saving).toBe(false);
  });
});
