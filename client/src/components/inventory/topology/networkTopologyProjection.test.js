import { describe, expect, it } from "vitest";
import { buildHierarchyTree } from "./networkTopologyHierarchy.js";
import { buildInventoryTopologyPreview, resolveTopologyDisplayNodes } from "./networkTopologyProjection.js";

const tree = buildHierarchyTree({
  groups: [{ id: "g1", name: "Escritório" }],
  segments: [
    { id: "s1", name: "Estações", groupId: "g1" },
    { id: "s2", name: "Impressoras", groupId: "" },
    { id: "m1", name: "Manutenção", groupId: "g1" }
  ],
  devices: [
    { id: "d1", name: "PC 1", segmentId: "s1", status: "online" },
    { id: "d2", name: "PC 2", segmentId: "s1", status: "offline" },
    { id: "d3", name: "PC 3", segmentId: "m1", status: "problem" }
  ]
});

describe("buildInventoryTopologyPreview", () => {
  it("mostra grupos e segmentos independentes na entrada do ambiente", () => {
    const nodes = buildInventoryTopologyPreview({ tree, viewLevel: "tab" });
    expect(nodes.map((node) => [node.nodeType, node.refId])).toEqual([
      ["group", "g1"], ["segment", "s2"], ["segment", "m1"]
    ]);
    expect(nodes.every((node) => node.preview && node.id.startsWith("inventory-preview:"))).toBe(true);
    expect(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it("grupo contém apenas seus segmentos, sem incorporar manutenção", () => {
    const nodes = buildInventoryTopologyPreview({ tree, viewLevel: "group", selectedGroupId: "g1" });
    expect(nodes.map((node) => node.refId)).toEqual(["s1"]);
  });

  it("segmento vazio no mapa ainda apresenta seus ativos reais", () => {
    const nodes = buildInventoryTopologyPreview({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    expect(nodes.map((node) => node.assetId)).toEqual(["d1", "d2"]);
    expect(nodes.every((node) => node.nodeType === "asset")).toBe(true);
    expect(resolveTopologyDisplayNodes([], nodes)).toBe(nodes);
  });

  it("manutenção mostra seus ativos sem exigir grupo", () => {
    expect(buildInventoryTopologyPreview({ tree, viewLevel: "segment", selectedSegmentId: "m1" })
      .map((node) => node.assetId)).toEqual(["d3"]);
  });

  it("não inventa conteúdo em escopos vazios ou mapas legados", () => {
    expect(buildInventoryTopologyPreview({ tree, viewLevel: "segment", selectedSegmentId: "s2" })).toEqual([]);
    expect(buildInventoryTopologyPreview({ tree, viewLevel: "group", selectedGroupId: "inexistente" })).toEqual([]);
    expect(buildInventoryTopologyPreview({ tree, viewLevel: "global-legado" })).toEqual([]);
  });

  it("posições locais são determinísticas para o mesmo inventário", () => {
    const input = { tree, viewLevel: "segment", selectedSegmentId: "s1" };
    expect(buildInventoryTopologyPreview(input)).toEqual(buildInventoryTopologyPreview(input));
  });

  it("mantém o array de nós salvos e todas as suas posições sem mesclar a prévia", () => {
    const saved = [{ id: "saved", assetId: "d1", x: -800, y: 4500, pinned: true, labelOverride: "Meu PC" }];
    const preview = buildInventoryTopologyPreview({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    expect(resolveTopologyDisplayNodes(saved, preview)).toBe(saved);
    expect(saved).toEqual([{ id: "saved", assetId: "d1", x: -800, y: 4500, pinned: true, labelOverride: "Meu PC" }]);
  });
});
