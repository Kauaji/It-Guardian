import { describe, expect, it } from "vitest";
import { buildHierarchyTree } from "./networkTopologyHierarchy.js";
import { topologyLinkKey, topologyNodeKey } from "./networkTopologyConnections.js";
import { buildInventoryTopologyNodes, getTopologySegments, resolveTopologyDisplayNodes } from "./networkTopologyProjection.js";

const tree = buildHierarchyTree({
  groups: [{ id: "g1", name: "Escritório" }],
  segments: [
    { id: "s1", name: "Estações", groupId: "g1" },
    { id: "s2", name: "Impressoras", groupId: "" },
    { id: "s3", name: "Servidores de backup", groupId: "g1" },
    { id: "m1", name: "Manutenção", groupId: "g1" },
    { id: "b1", name: "Backup" },
    { id: "b2", name: "Reserva", isBackupSegment: true }
  ],
  devices: [
    { id: "d1", name: "PC 1", segmentId: "s1", status: "online" },
    { id: "d2", name: "PC 2", segmentId: "s1", status: "offline" },
    { id: "d3", name: "PC 3", segmentId: "m1", status: "problem" },
    { id: "d4", name: "Servidor", segmentId: "s3", status: "online" },
    { id: "d5", name: "Reserva 1", segmentId: "b1", status: "online" },
    { id: "d6", name: "Reserva 2", segmentId: "b2", status: "online" }
  ]
});

describe("buildInventoryTopologyNodes", () => {
  it("mostra grupos e segmentos elegíveis como nós automáticos, sem estado de prévia", () => {
    const nodes = buildInventoryTopologyNodes({ tree, viewLevel: "tab" });
    expect(nodes.map((node) => [node.nodeType, node.refId])).toEqual([
      ["group", "g1"], ["segment", "s2"]
    ]);
    expect(nodes.every((node) => node.automatic && node.id.startsWith("inventory-default:"))).toBe(true);
    expect(nodes.every((node) => !Object.hasOwn(node, "preview"))).toBe(true);
    expect(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it("grupo contém seus segmentos reais, preservando nomes comuns que mencionam backup", () => {
    const nodes = buildInventoryTopologyNodes({ tree, viewLevel: "group", selectedGroupId: "g1" });
    expect(nodes.map((node) => node.refId)).toEqual(["s1", "s3"]);
  });

  it("segmento apresenta todos os seus ativos reais sem depender de posições salvas", () => {
    const nodes = buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    expect(nodes.map((node) => node.assetId)).toEqual(["d1", "d2"]);
    expect(nodes.every((node) => node.nodeType === "asset")).toBe(true);
    expect(resolveTopologyDisplayNodes([], nodes)).toBe(nodes);
  });

  it.each(["m1", "b1", "b2"])("não disponibiliza um segmento operacional excluído nem seus ativos: %s", (selectedSegmentId) => {
    expect(buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId })).toEqual([]);
  });

  it("não inventa conteúdo em escopos vazios ou mapas legados", () => {
    expect(buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId: "s2" })).toEqual([]);
    expect(buildInventoryTopologyNodes({ tree, viewLevel: "group", selectedGroupId: "inexistente" })).toEqual([]);
    expect(buildInventoryTopologyNodes({ tree, viewLevel: "global-legado" })).toEqual([]);
  });

  it("posições locais são determinísticas para o mesmo inventário", () => {
    const input = { tree, viewLevel: "segment", selectedSegmentId: "s1" };
    expect(buildInventoryTopologyNodes(input)).toEqual(buildInventoryTopologyNodes(input));
  });

  it("não recupera filas especiais de uma árvore antiga com maintenanceSegments", () => {
    const special = { id: "old", name: "Manutenção", devices: [{ id: "old-device" }] };
    const oldTree = {
      groups: [{ id: "old-group", segments: [{ id: "stock", name: "Reserva", isBackupSegment: true }] }],
      ungroupedSegments: [{ id: "backup", name: " Backup " }, special],
      maintenanceSegments: [special]
    };
    expect(getTopologySegments(oldTree)).toEqual([]);
    expect(buildInventoryTopologyNodes({ tree: oldTree, viewLevel: "tab" }).map((node) => node.refId)).toEqual(["old-group"]);
    expect(buildInventoryTopologyNodes({ tree: oldTree, viewLevel: "group", selectedGroupId: "old-group" })).toEqual([]);
    expect(buildInventoryTopologyNodes({ tree: oldTree, viewLevel: "segment", selectedSegmentId: "old" })).toEqual([]);
  });
});

describe("resolveTopologyDisplayNodes", () => {
  it("mescla todos os ativos do escopo com um layout parcial, preservando o nó salvo inteiro", () => {
    const savedNode = Object.freeze({
      id: "saved", assetId: "d1", x: -800, y: 4500, pinned: true,
      labelOverride: "Meu PC", metadata: Object.freeze({ note: "personalizado" })
    });
    const saved = Object.freeze([savedNode]);
    const inventory = buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    const result = resolveTopologyDisplayNodes(saved, inventory);
    expect(result).toEqual([savedNode, inventory[1]]);
    expect(result[0]).toBe(savedNode);
    expect(result[1].automatic).toBe(true);
    expect(saved).toHaveLength(1);
    expect(inventory[0].id).toBe("inventory-default:asset:d1");
  });

  it("mostra uma máquina nova mesmo quando ela ainda não tem nenhuma conexão salva", () => {
    const saved = [{ id: "saved-1", assetId: "d1", x: 120, y: 230 }];
    const existing = buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    const incoming = { id: "inventory-default:asset:incoming", nodeType: "asset", assetId: "incoming", x: 1400, y: 500, automatic: true };
    const result = resolveTopologyDisplayNodes(saved, [...existing, incoming]);
    expect(result.map((node) => node.assetId)).toEqual(["d1", "d2", "incoming"]);
    expect(result[0]).toBe(saved[0]);
    expect(result[2]).toBe(incoming);
  });

  it("não confunde grupo, segmento e ativo com o mesmo ID de referência", () => {
    const saved = [
      { id: "saved-group", nodeType: "group", refId: "shared", x: 1, y: 2, pinned: true },
      { id: "saved-segment", nodeType: "segment", refId: "shared", x: 3, y: 4, labelOverride: "Segmento" },
      { id: "saved-asset", assetId: "shared", x: 5, y: 6, pinned: false }
    ];
    const inventory = [
      { id: "default-segment", nodeType: "segment", refId: "shared" },
      { id: "default-asset", nodeType: "asset", assetId: "shared" },
      { id: "default-group", nodeType: "group", refId: "shared" }
    ];
    const result = resolveTopologyDisplayNodes(saved, inventory);
    expect(result).toEqual([saved[1], saved[2], saved[0]]);
    expect(result.every((node) => saved.includes(node))).toBe(true);
  });

  it("omite nós de outros escopos sem apagar seus registros ou conexões", () => {
    const links = Object.freeze([
      Object.freeze({ id: "link-12", sourceAssetId: "d1", targetAssetId: "d2" }),
      Object.freeze({ id: "old-link", sourceAssetId: "d1", targetAssetId: "outside" })
    ]);
    const savedNode = Object.freeze({ id: "saved-1", assetId: "d1", x: 150, y: 300 });
    const removedNode = Object.freeze({ id: "saved-outside", assetId: "outside", x: 900, y: 1000, pinned: true });
    const bundle = Object.freeze({ nodes: Object.freeze([removedNode, savedNode]), links });
    const inventory = buildInventoryTopologyNodes({ tree, viewLevel: "segment", selectedSegmentId: "s1" });
    const result = resolveTopologyDisplayNodes(bundle.nodes, inventory);
    const displayKeys = new Set(result.map(topologyNodeKey));
    expect(result).toEqual([savedNode, inventory[1]]);
    expect(displayKeys.has(topologyLinkKey(links[0], "source"))).toBe(true);
    expect(displayKeys.has(topologyLinkKey(links[0], "target"))).toBe(true);
    expect(displayKeys.has(topologyLinkKey(links[1], "target"))).toBe(false);
    expect(bundle.nodes).toEqual([removedNode, savedNode]);
    expect(bundle.links).toBe(links);
    expect(bundle.links).toHaveLength(2);
    expect(removedNode.pinned).toBe(true);
  });

  it("um escopo hierárquico vazio não reexibe nós salvos antigos", () => {
    const saved = [{ id: "old", nodeType: "group", refId: "outside", x: 800, y: 500 }];
    const inventory = [];
    expect(resolveTopologyDisplayNodes(saved, inventory)).toBe(inventory);
    expect(saved).toHaveLength(1);
  });
});
