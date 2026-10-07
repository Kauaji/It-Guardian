import { describe, expect, it } from "vitest";
import { buildSearchSections, filterHierarchy, toggleInSet } from "./hierarchySidebarModel.js";

const tree = {
  groups: [
    {
      id: "g1",
      name: "Matriz",
      segments: [
        { id: "s1", name: "Estações" },
        { id: "s2", name: "Servidores" }
      ]
    },
    { id: "g2", name: "Filial", segments: [] }
  ],
  ungroupedSegments: [{ id: "s3", name: "Laboratório" }]
};

describe("hierarchySidebarModel", () => {
  it("cria as seções pesquisáveis com tags de grupo", () => {
    const [groups, segments] = buildSearchSections(tree);
    expect(groups.items.map((item) => item.id)).toEqual(["g1", "g2"]);
    expect(segments.items.map((item) => [item.id, item.tags])).toEqual([
      ["s1", ["segmento", "Matriz"]],
      ["s2", ["segmento", "Matriz"]],
      ["s3", ["segmento"]]
    ]);
  });

  it("não filtra sem consulta", () => {
    const result = filterHierarchy(tree, buildSearchSections(tree), "   ");
    expect(result.matchedGroupIds).toBeNull();
    expect(result.visibleGroups).toBe(tree.groups);
    expect(result.visibleUngrouped).toBe(tree.ungroupedSegments);
  });

  it("filtra grupos por nome ou por segmento casado e segmentos soltos", () => {
    const sections = buildSearchSections(tree);
    const byGroup = filterHierarchy(tree, sections, "filial");
    expect(byGroup.visibleGroups.map((group) => group.id)).toEqual(["g2"]);
    expect(byGroup.visibleUngrouped).toEqual([]);
    const bySegment = filterHierarchy(tree, sections, "servidores");
    expect(bySegment.visibleGroups.map((group) => group.id)).toEqual(["g1"]);
    expect(bySegment.matchedSegmentIds.has("s2")).toBe(true);
    const ungrouped = filterHierarchy(tree, sections, "laboratório");
    expect(ungrouped.visibleUngrouped.map((segment) => segment.id)).toEqual(["s3"]);
    expect(filterHierarchy(tree, sections, "zzzz").visibleGroups).toEqual([]);
  });

  it("alterna ids em uma cópia do conjunto", () => {
    const original = new Set(["a"]);
    const added = toggleInSet(original, "b");
    expect([...added]).toEqual(["a", "b"]);
    expect([...toggleInSet(added, "a")]).toEqual(["b"]);
    expect([...original]).toEqual(["a"]);
  });
});
