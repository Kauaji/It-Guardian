import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNetworkTopologyNode,
  deleteNetworkTopologyNode,
  fetchNetworkTopologyMap,
  saveNetworkTopologyNodePositions
} from "../../../api.js";
import { ensureTopologyNode, saveTopologyPositions } from "./networkTopologyPersistence.js";

vi.mock("../../../api.js", () => ({
  createNetworkTopologyNode: vi.fn(),
  deleteNetworkTopologyNode: vi.fn(),
  fetchNetworkTopologyMap: vi.fn(),
  saveNetworkTopologyNodePositions: vi.fn()
}));

const mapId = "map-current";
const token = "local-test-session";
const context = { token, mapId };

function automaticAsset(assetId = "asset-a", overrides = {}) {
  return {
    id: `inventory-default:asset:${assetId}`,
    nodeType: "asset", assetId, refId: null,
    x: 800, y: 500, pinned: false, automatic: true,
    ...overrides
  };
}

function automaticCluster(nodeType = "segment", refId = "cluster-a", overrides = {}) {
  return {
    id: `inventory-default:${nodeType}:${refId}`,
    nodeType, refId, assetId: null,
    x: 400, y: 250, pinned: false, automatic: true,
    ...overrides
  };
}

function persisted(node, overrides = {}) {
  return {
    id: `saved:${node.nodeType}:${node.assetId || node.refId}`,
    mapId,
    nodeType: node.nodeType,
    assetId: node.assetId || null,
    refId: node.refId || null,
    x: node.x, y: node.y, pinned: node.pinned,
    labelOverride: node.labelOverride || null,
    ...overrides
  };
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

function httpError(statusCode) {
  return Object.assign(new Error(`Falha HTTP ${statusCode}`), { statusCode });
}

function expectNoWrites() {
  expect(createNetworkTopologyNode).not.toHaveBeenCalled();
  expect(saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ensureTopologyNode", () => {
  it("materializa ativo usando ID real, posição-base e metadados sem enviar o ID local", async () => {
    const node = Object.freeze(automaticAsset("device-real", { pinned: true, labelOverride: "Servidor principal" }));
    const saved = Object.freeze(persisted(node));
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockResolvedValue({ node: saved });

    expect(await ensureTopologyNode({ ...context, node, onMaterialized })).toBe(saved);
    expect(createNetworkTopologyNode).toHaveBeenCalledExactlyOnceWith(token, mapId, {
      nodeType: "asset", assetId: "device-real", x: 800, y: 500,
      pinned: true, labelOverride: "Servidor principal"
    });
    expect(onMaterialized).toHaveBeenCalledExactlyOnceWith(saved, node);
    expect(fetchNetworkTopologyMap).not.toHaveBeenCalled();
    expect(node.automatic).toBe(true);
    expect(saved).not.toHaveProperty("automatic");
  });

  it.each(["group", "segment"])("materializa %s usando refId, sem confundir com assetId", async (nodeType) => {
    const node = automaticCluster(nodeType, "real-reference");
    const saved = persisted(node);
    createNetworkTopologyNode.mockResolvedValue({ node: saved });

    expect(await ensureTopologyNode({ ...context, node })).toBe(saved);
    expect(createNetworkTopologyNode).toHaveBeenCalledExactlyOnceWith(token, mapId, {
      nodeType, refId: "real-reference", x: 400, y: 250, pinned: false
    });
  });

  it("retorna nó já salvo por referência sem escrever ou executar callback", async () => {
    const node = persisted(automaticAsset(), { pinned: true, labelOverride: "Rótulo preservado" });
    const onMaterialized = vi.fn();

    expect(await ensureTopologyNode({ ...context, node, onMaterialized })).toBe(node);
    expectNoWrites();
    expect(fetchNetworkTopologyMap).not.toHaveBeenCalled();
    expect(onMaterialized).not.toHaveBeenCalled();
  });

  it.each([409, 500, 503, undefined])("reconcilia erro %s no mesmo mapa sem repetir POST", async (statusCode) => {
    const node = automaticAsset("reference-shared");
    const saved = Object.freeze(persisted(node, { x: -90, y: 4200, pinned: true, labelOverride: "De outro editor" }));
    const wrongType = persisted(automaticCluster("segment", "reference-shared"));
    const links = Object.freeze([{ id: "existing-link", sourceAssetId: node.assetId, targetAssetId: "asset-b" }]);
    const bundle = Object.freeze({ map: { id: mapId }, nodes: Object.freeze([wrongType, saved]), links });
    const creationError = statusCode ? httpError(statusCode) : new Error("Não foi possível conectar ao servidor.");
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockRejectedValue(creationError);
    fetchNetworkTopologyMap.mockResolvedValue(bundle);

    expect(await ensureTopologyNode({ ...context, node, onMaterialized })).toBe(saved);
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
    expect(fetchNetworkTopologyMap).toHaveBeenCalledExactlyOnceWith(token, mapId);
    expect(onMaterialized).toHaveBeenCalledExactlyOnceWith(saved, node);
    expect(saved).toMatchObject({ x: -90, y: 4200, pinned: true, labelOverride: "De outro editor" });
    expect(bundle.links).toBe(links);
    expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 429])("não reconcilia rejeição definitiva HTTP %s", async (statusCode) => {
    const error = httpError(statusCode);
    createNetworkTopologyNode.mockRejectedValue(error);

    await expect(ensureTopologyNode({ ...context, node: automaticAsset() })).rejects.toBe(error);
    expect(fetchNetworkTopologyMap).not.toHaveBeenCalled();
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
  });

  it.each(["missing-reference", "wrong-type", "wrong-map", "failed-read"])(
    "mantém o erro original quando reconciliação falha: %s", async (scenario) => {
      const node = automaticAsset();
      const error = httpError(409);
      const onMaterialized = vi.fn();
      createNetworkTopologyNode.mockRejectedValue(error);
      if (scenario === "failed-read") {
        fetchNetworkTopologyMap.mockRejectedValue(new Error("Falha na consulta"));
      } else {
        fetchNetworkTopologyMap.mockResolvedValue({
          map: { id: scenario === "wrong-map" ? "different-map" : mapId },
          nodes: scenario === "missing-reference" ? [] : [
            scenario === "wrong-type" ? persisted(automaticCluster("segment", node.assetId)) : persisted(node)
          ]
        });
      }

      await expect(ensureTopologyNode({ ...context, node, onMaterialized })).rejects.toBe(error);
      expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
      expect(onMaterialized).not.toHaveBeenCalled();
      expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
    }
  );

  it("cancela antes de qualquer escrita ou validação de um contexto antigo", async () => {
    expect(await ensureTopologyNode({ mapId: null, node: null, isCurrent: () => false })).toBeNull();
    expectNoWrites();
  });

  it.each(["resolve", "reject"])("ignora POST tardio (%s) depois da troca de contexto", async (outcome) => {
    const pending = deferred();
    let current = true;
    const node = automaticAsset();
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockReturnValue(pending.promise);
    const saving = ensureTopologyNode({ ...context, node, isCurrent: () => current, onMaterialized });

    current = false;
    if (outcome === "resolve") pending.resolve({ node: persisted(node) });
    else pending.reject(httpError(503));

    expect(await saving).toBeNull();
    expect(onMaterialized).not.toHaveBeenCalled();
    expect(fetchNetworkTopologyMap).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"])("ignora reconciliação tardia (%s) depois da troca de contexto", async (outcome) => {
    const pending = deferred();
    let current = true;
    const node = automaticAsset();
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockRejectedValue(httpError(409));
    fetchNetworkTopologyMap.mockReturnValue(pending.promise);
    const saving = ensureTopologyNode({ ...context, node, isCurrent: () => current, onMaterialized });
    await vi.waitFor(() => expect(fetchNetworkTopologyMap).toHaveBeenCalledTimes(1));

    current = false;
    if (outcome === "resolve") pending.resolve({ map: { id: mapId }, nodes: [persisted(node)] });
    else pending.reject(httpError(503));

    expect(await saving).toBeNull();
    expect(onMaterialized).not.toHaveBeenCalled();
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
  });
});

describe("saveTopologyPositions", () => {
  it("materializa só os itens alterados e aplica todas as posições em um PATCH final", async () => {
    const automatic = Object.freeze(automaticAsset());
    const existing = Object.freeze(persisted(automaticCluster("group", "group-existing"), {
      pinned: true, labelOverride: "Grupo principal"
    }));
    const created = Object.freeze(persisted(automatic));
    const response = { nodes: [{ ...created, x: 70, y: 90 }, { ...existing, x: -50, y: 800 }] };
    const changes = Object.freeze([
      Object.freeze({ node: automatic, x: 70, y: 90 }),
      Object.freeze({ node: existing, x: -50, y: 800 })
    ]);
    const calls = [];
    const onMaterialized = vi.fn(() => calls.push("materialized"));
    createNetworkTopologyNode.mockImplementation(async () => {
      calls.push("create");
      return { node: created };
    });
    saveNetworkTopologyNodePositions.mockImplementation(async () => {
      calls.push("positions");
      return response;
    });

    expect(await saveTopologyPositions({ ...context, changes, onMaterialized })).toBe(response);
    expect(createNetworkTopologyNode).toHaveBeenCalledExactlyOnceWith(token, mapId, {
      nodeType: "asset", assetId: automatic.assetId, x: 800, y: 500, pinned: false
    });
    expect(saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(token, mapId, [
      { nodeId: created.id, x: 70, y: 90 }, { nodeId: existing.id, x: -50, y: 800 }
    ]);
    expect(calls).toEqual(["create", "materialized", "positions"]);
    expect(onMaterialized).toHaveBeenCalledExactlyOnceWith(created, automatic);
    expect(existing).toMatchObject({ pinned: true, labelOverride: "Grupo principal", x: 400, y: 250 });
    expect(automatic.x).toBe(800);
  });

  it("salva nós existentes sem POST e mantém metadados fora do PATCH de posições", async () => {
    const node = persisted(automaticAsset(), { pinned: true });
    const response = { nodes: [{ ...node, x: 1, y: 2 }] };
    saveNetworkTopologyNodePositions.mockResolvedValue(response);

    expect(await saveTopologyPositions({ ...context, changes: [{ node, x: 1, y: 2 }] })).toBe(response);
    expect(createNetworkTopologyNode).not.toHaveBeenCalled();
    expect(saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(token, mapId, [{ nodeId: node.id, x: 1, y: 2 }]);
  });

  it("deduplica referências mantendo última posição sem misturar ativo e segmento de mesmo ID", async () => {
    const asset = automaticAsset("shared-reference");
    const segment = automaticCluster("segment", "shared-reference");
    const savedAsset = persisted(asset);
    const savedSegment = persisted(segment);
    createNetworkTopologyNode.mockResolvedValueOnce({ node: savedAsset }).mockResolvedValueOnce({ node: savedSegment });
    saveNetworkTopologyNodePositions.mockResolvedValue({ nodes: [savedAsset, savedSegment] });

    await saveTopologyPositions({ ...context, changes: [
      { node: asset, x: 10, y: 20 },
      { node: segment, x: 30, y: 40 },
      { node: { ...asset, id: "another-local-id" }, x: 50, y: 60 }
    ] });
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(2);
    expect(saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(token, mapId, [
      { nodeId: savedAsset.id, x: 50, y: 60 }, { nodeId: savedSegment.id, x: 30, y: 40 }
    ]);
  });

  it.each([true, false])("prioriza UUID conhecido entre duplicatas (salvo primeiro: %s)", async (savedFirst) => {
    const automatic = automaticAsset();
    const saved = persisted(automatic);
    const nodes = savedFirst ? [saved, automatic] : [automatic, saved];
    saveNetworkTopologyNodePositions.mockResolvedValue({ nodes: [saved] });

    await saveTopologyPositions({ ...context, changes: nodes.map((node, index) => ({ node, x: index * 50, y: index * 60 })) });
    expect(createNetworkTopologyNode).not.toHaveBeenCalled();
    expect(saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(token, mapId, [{ nodeId: saved.id, x: 50, y: 60 }]);
  });

  it.each([NaN, Infinity, -Infinity, null, "12", undefined])("rejeita coordenada inválida %s antes da primeira escrita", async (x) => {
    await expect(saveTopologyPositions({ ...context, changes: [
      { node: automaticAsset("valid-first"), x: 20, y: 30 },
      { node: persisted(automaticAsset("invalid-second")), x, y: 40 }
    ] })).rejects.toThrow("coordenadas válidas");
    expectNoWrites();
  });

  it.each([
    { name: "posição-base", node: automaticAsset("invalid", { x: NaN }) },
    { name: "referência real", node: automaticAsset(null) },
    { name: "outro mapa", node: persisted(automaticAsset(), { mapId: "other-map" }) },
    { name: "tipo desconhecido", node: automaticCluster("unknown") },
    { name: "UUID ausente", node: persisted(automaticAsset(), { id: "" }) }
  ])("valida $name no lote completo antes de materializar", async ({ node }) => {
    await expect(saveTopologyPositions({ ...context, changes: [
      { node: automaticAsset("valid-first"), x: 10, y: 20 }, { node, x: 30, y: 40 }
    ] })).rejects.toThrow();
    expectNoWrites();
  });

  it("reutiliza UUID reconciliado em 409 no PATCH de todas as posições", async () => {
    const node = automaticAsset();
    const saved = persisted(node, { pinned: true });
    createNetworkTopologyNode.mockRejectedValue(httpError(409));
    fetchNetworkTopologyMap.mockResolvedValue({ map: { id: mapId }, nodes: [saved], links: [] });
    saveNetworkTopologyNodePositions.mockResolvedValue({ nodes: [{ ...saved, x: 55, y: 66 }] });

    await saveTopologyPositions({ ...context, changes: [{ node, x: 55, y: 66 }] });
    expect(saveNetworkTopologyNodePositions).toHaveBeenCalledExactlyOnceWith(token, mapId, [{ nodeId: saved.id, x: 55, y: 66 }]);
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
    expect(saved.pinned).toBe(true);
  });

  it("preserva materializações confirmadas quando PATCH falha, sem DELETE compensatório", async () => {
    const node = automaticAsset();
    const saved = persisted(node);
    const onMaterialized = vi.fn();
    const error = httpError(500);
    createNetworkTopologyNode.mockResolvedValue({ node: saved });
    saveNetworkTopologyNodePositions.mockRejectedValue(error);

    await expect(saveTopologyPositions({ ...context, changes: [{ node, x: 40, y: 50 }], onMaterialized })).rejects.toBe(error);
    expect(onMaterialized).toHaveBeenCalledExactlyOnceWith(saved, node);
    expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
    expect(node).toMatchObject({ automatic: true, x: 800, y: 500 });
    expect(saved).toMatchObject({ x: 800, y: 500 });
  });

  it("não aplica PATCH parcial se a criação de um segundo item falhar", async () => {
    const first = automaticAsset("first");
    const second = automaticAsset("second");
    const saved = persisted(first);
    const error = httpError(403);
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockResolvedValueOnce({ node: saved }).mockRejectedValueOnce(error);

    await expect(saveTopologyPositions({ ...context, changes: [
      { node: first, x: 40, y: 50 }, { node: second, x: 60, y: 70 }
    ], onMaterialized })).rejects.toBe(error);
    expect(onMaterialized).toHaveBeenCalledExactlyOnceWith(saved, first);
    expect(saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
    expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
  });

  it("lote vazio não envia o PATCH vazio recusado pelo servidor", async () => {
    expect(await saveTopologyPositions({ ...context, changes: [] })).toEqual({ nodes: [] });
    expectNoWrites();
  });

  it("contexto cancelado antes do início não escreve", async () => {
    expect(await saveTopologyPositions({ ...context, changes: [{ node: automaticAsset(), x: 1, y: 2 }], isCurrent: () => false })).toBeNull();
    expectNoWrites();
  });

  it("troca de contexto durante POST bloqueia próxima criação e PATCH", async () => {
    const pending = deferred();
    let current = true;
    const first = automaticAsset("first");
    const onMaterialized = vi.fn();
    createNetworkTopologyNode.mockReturnValue(pending.promise);
    const saving = saveTopologyPositions({ ...context, changes: [
      { node: first, x: 1, y: 2 }, { node: automaticAsset("second"), x: 3, y: 4 }
    ], isCurrent: () => current, onMaterialized });

    current = false;
    pending.resolve({ node: persisted(first) });
    expect(await saving).toBeNull();
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
    expect(saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
    expect(onMaterialized).not.toHaveBeenCalled();
  });

  it("nova navegação após callback impede as escritas seguintes", async () => {
    let current = true;
    const first = automaticAsset("first");
    const onMaterialized = vi.fn(() => { current = false; });
    createNetworkTopologyNode.mockResolvedValue({ node: persisted(first) });

    expect(await saveTopologyPositions({ ...context, changes: [
      { node: first, x: 1, y: 2 }, { node: automaticAsset("second"), x: 3, y: 4 }
    ], isCurrent: () => current, onMaterialized })).toBeNull();
    expect(onMaterialized).toHaveBeenCalledTimes(1);
    expect(createNetworkTopologyNode).toHaveBeenCalledTimes(1);
    expect(saveNetworkTopologyNodePositions).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"])("ignora PATCH tardio (%s) após trocar de mapa", async (outcome) => {
    const pending = deferred();
    let current = true;
    const saved = persisted(automaticAsset());
    saveNetworkTopologyNodePositions.mockReturnValue(pending.promise);
    const saving = saveTopologyPositions({ ...context, changes: [{ node: saved, x: 1, y: 2 }], isCurrent: () => current });
    await vi.waitFor(() => expect(saveNetworkTopologyNodePositions).toHaveBeenCalledTimes(1));

    current = false;
    if (outcome === "resolve") pending.resolve({ nodes: [{ ...saved, x: 1, y: 2 }] });
    else pending.reject(httpError(503));

    expect(await saving).toBeNull();
    expect(createNetworkTopologyNode).not.toHaveBeenCalled();
    expect(deleteNetworkTopologyNode).not.toHaveBeenCalled();
  });
});
