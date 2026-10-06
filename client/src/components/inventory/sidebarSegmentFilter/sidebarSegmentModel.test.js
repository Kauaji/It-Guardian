import { describe, expect, it } from "vitest";
import { countDevicesBySegment, getOccupiedMaintenanceSegments, groupSegmentsByGroupId, sumGroupCount } from "./sidebarSegmentModel.js";

describe("sidebarSegmentModel", () => {
  const segments = [
    { id: "s1", name: "A", groupId: "g1" },
    { id: "s2", name: "B" },
    { id: "m1", name: "Manutenção" },
    { id: "m2", name: "Manutencao" }
  ];
  const groups = [
    { id: "g1", name: "G" },
    { id: "g2", name: "Vazio" }
  ];

  it("conta dispositivos por segmento", () => {
    const counts = countDevicesBySegment([{ segmentId: "s1" }, { segmentId: "s1" }, { segmentId: "m1" }, {}]);
    expect(counts.get("s1")).toBe(2);
    expect(counts.get("m1")).toBe(1);
    expect(counts.get(undefined)).toBe(1);
  });

  it("mantém só segmentos de manutenção ocupados", () => {
    const counts = new Map([["m1", 2]]);
    expect(getOccupiedMaintenanceSegments(segments, counts).map((segment) => segment.id)).toEqual(["m1"]);
  });

  it("agrupa segmentos por grupo, deixando a manutenção de fora", () => {
    const grouped = groupSegmentsByGroupId(segments, groups);
    expect(grouped.get("g1").map((segment) => segment.id)).toEqual(["s1"]);
    expect(grouped.get("g2")).toEqual([]);
    expect(grouped.get("").map((segment) => segment.id)).toEqual(["s2"]);
  });

  it("soma contagens ignorando segmentos sem dispositivos", () => {
    expect(
      sumGroupCount(
        segments,
        new Map([
          ["s1", 2],
          ["s2", 3]
        ])
      )
    ).toBe(5);
    expect(sumGroupCount([], new Map())).toBe(0);
  });
});
