import { describe, expect, it } from "vitest";
import { getNodeDimensions } from "./networkTopologyModel.js";
import { DEFAULT_TOPOLOGY_VIEWBOX, fitTopologyViewBox } from "./networkTopologyViewport.js";

describe("fitTopologyViewBox", () => {
  it("enquadra todos os nós em mapas altos, largos e telas estreitas sem movê-los", () => {
    const nodes = [
      { nodeType: "asset", x: -800, y: 4500 },
      { nodeType: "group", x: 3200, y: -900 }
    ];
    for (const ratio of [0.6, 1.6, 2.4]) {
      const box = fitTopologyViewBox(nodes, ratio);
      expect(box.width / box.height).toBeCloseTo(ratio);
      for (const node of nodes) {
        const { width, height } = getNodeDimensions(node);
        expect(node.x - width / 2).toBeGreaterThan(box.x);
        expect(node.x + width / 2).toBeLessThan(box.x + box.width);
        expect(node.y - height / 2).toBeGreaterThan(box.y);
        expect(node.y + height / 2).toBeLessThan(box.y + box.height);
      }
    }
    expect(nodes[0]).toEqual({ nodeType: "asset", x: -800, y: 4500 });
  });

  it("usa viewport padrão sem posições válidas", () => {
    expect(fitTopologyViewBox([])).toEqual(DEFAULT_TOPOLOGY_VIEWBOX);
    expect(fitTopologyViewBox([{ x: NaN, y: 100 }])).toEqual(DEFAULT_TOPOLOGY_VIEWBOX);
  });

  it("mantém uma prévia pequena legível e uma proporção inválida não quebra o mapa", () => {
    const nodes = [{ x: 800, y: 500 }];
    const box = fitTopologyViewBox(nodes, 0);
    expect(box.width).toBeLessThan(DEFAULT_TOPOLOGY_VIEWBOX.width);
    expect(Number.isFinite(box.height)).toBe(true);
  });
});
