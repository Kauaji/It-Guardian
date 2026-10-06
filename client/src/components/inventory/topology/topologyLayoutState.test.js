import { describe, expect, it } from "vitest";
import {
  autoLayoutHints,
  dirtyPositionChanges,
  mergeSavedNodes,
  withDraggedPosition,
  withoutSavedPositions
} from "./topologyLayoutState.js";
import { topologyNodeKey } from "./networkTopologyConnections.js";

const nodeA = { id: "n1", nodeType: "asset", assetId: "a1", x: 10, y: 20 };
const nodeB = { id: "n2", nodeType: "group", refId: "g1", x: 0, y: 0 };

describe("topologyLayoutState", () => {
  it("mescla nós salvos no bundle do mesmo mapa e ignora outro mapa", () => {
    const bundle = { map: { id: "m1" }, nodes: [nodeA], links: [] };
    const saved = { ...nodeA, x: 99 };
    const merged = mergeSavedNodes(bundle, "m1", [saved, nodeB]);
    expect(merged.nodes).toEqual([saved, nodeB]);
    expect(mergeSavedNodes(bundle, "outro", [saved])).toBe(bundle);
    expect(mergeSavedNodes(null, "m1", [saved])).toBeNull();
  });

  it("registra a posição arrastada e remove a pendência ao voltar à base", () => {
    const dirty = withDraggedPosition(new Map(), nodeA, 11, 22);
    expect(dirty.get(topologyNodeKey(nodeA))).toEqual({ x: 11, y: 22 });
    expect(withDraggedPosition(dirty, nodeA, 10, 20).size).toBe(0);
  });

  it("descarta só as posições salvas que não mudaram desde o snapshot", () => {
    const keyA = topologyNodeKey(nodeA);
    const keyB = topologyNodeKey(nodeB);
    const snapshot = new Map([
      [keyA, { x: 1, y: 2 }],
      [keyB, { x: 3, y: 4 }]
    ]);
    const current = new Map([
      [keyA, { x: 1, y: 2 }],
      [keyB, { x: 9, y: 9 }]
    ]);
    expect([...withoutSavedPositions(current, snapshot).keys()]).toEqual([keyB]);
  });

  it("monta as alterações e as dicas do layout automático", () => {
    const snapshot = new Map([[topologyNodeKey(nodeA), { x: 1, y: 2 }]]);
    expect(dirtyPositionChanges([nodeA, nodeB], snapshot)).toEqual([{ node: nodeA, x: 1, y: 2 }]);
    expect(autoLayoutHints([nodeA, nodeB], new Map([["a1", { assetType: "server" }]]))).toHaveLength(1);
  });
});
