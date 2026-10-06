import { describe, expect, it, vi } from "vitest";
import {
  CONNECTION_ITEM_LABELS_BY_TYPE,
  MIXED_CONNECTION_ITEM_LABELS,
  buildConnectionGuideText,
  emptyStateVariant,
  jitteredCenter,
  resolveConnectionItemLabels
} from "./topologyViewConstants.js";

describe("topologyViewConstants", () => {
  it("escolhe os rótulos conforme os tipos dos nós visíveis", () => {
    expect(resolveConnectionItemLabels([{ nodeType: "group" }, { nodeType: "group" }], "tab")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.group);
    expect(resolveConnectionItemLabels([{}, { nodeType: "asset" }], "segment")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.asset);
    expect(resolveConnectionItemLabels([{ nodeType: "unknown" }], "segment")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.asset);
    expect(resolveConnectionItemLabels([{ nodeType: "group" }, { nodeType: "segment" }], "tab")).toBe(MIXED_CONNECTION_ITEM_LABELS);
  });

  it("usa o rótulo do nível quando não há nós visíveis", () => {
    expect(resolveConnectionItemLabels([], "tab")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.group);
    expect(resolveConnectionItemLabels([], "group")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.segment);
    expect(resolveConnectionItemLabels([], "segment")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.asset);
    expect(resolveConnectionItemLabels([], "global-legado")).toBe(CONNECTION_ITEM_LABELS_BY_TYPE.asset);
  });

  it("monta o texto do guia de conexão nos três estados", () => {
    const labels = CONNECTION_ITEM_LABELS_BY_TYPE.segment;
    expect(buildConnectionGuideText({ creatingLink: true, sourceNodeId: "n", labels })).toBe("Salvando conexão entre segmentos…");
    expect(buildConnectionGuideText({ creatingLink: false, sourceNodeId: "n", labels })).toBe(
      "Segmento de origem selecionado. Clique no segmento de destino para salvar a conexão."
    );
    expect(buildConnectionGuideText({ creatingLink: false, sourceNodeId: null, labels })).toBe(
      "Clique no primeiro segmento para escolher a origem da conexão."
    );
  });

  it("define a variante do estado vazio por nível", () => {
    expect(emptyStateVariant("segment")).toBe("segment-sem-ativos");
    expect(emptyStateVariant("group")).toBe("group-sem-segmentos");
    expect(emptyStateVariant("tab")).toBe("tab-sem-grupos");
  });

  it("posiciona novos ativos próximos ao centro", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(jitteredCenter()).toEqual({ x: 800, y: 500 });
    Math.random.mockReturnValue(0);
    expect(jitteredCenter()).toEqual({ x: 670, y: 370 });
    vi.restoreAllMocks();
  });
});
