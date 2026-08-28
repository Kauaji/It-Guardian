import { describe, expect, it } from "vitest";
import { getNodeDimensions } from "./networkTopologyModel.js";
import {
  DEFAULT_TOPOLOGY_VIEWBOX,
  MAX_TOPOLOGY_VIEWBOX_WIDTH,
  MIN_TOPOLOGY_VIEWBOX_WIDTH,
  fitTopologyViewBox,
  normalizeTopologyWheelDelta,
  zoomTopologyViewBox
} from "./networkTopologyViewport.js";

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

describe("normalizeTopologyWheelDelta", () => {
  it("normaliza pixels, linhas e páginas sem perder a direção", () => {
    expect(normalizeTopologyWheelDelta(48)).toBe(48);
    expect(normalizeTopologyWheelDelta(3, 1)).toBe(48);
    expect(normalizeTopologyWheelDelta(-3, 1)).toBe(-48);
    expect(normalizeTopologyWheelDelta(0.1, 2, 480)).toBe(48);
  });

  it("limita deltas extremos e mantém a precisão do trackpad", () => {
    expect(normalizeTopologyWheelDelta(10000)).toBe(120);
    expect(normalizeTopologyWheelDelta(-1, 2, 1000)).toBe(-120);
    expect(normalizeTopologyWheelDelta(0.25)).toBe(0.25);
  });

  it("ignora deltas inválidos e usa uma altura segura para páginas", () => {
    expect(normalizeTopologyWheelDelta(NaN)).toBe(0);
    expect(normalizeTopologyWheelDelta(Infinity)).toBe(0);
    expect(normalizeTopologyWheelDelta(0)).toBe(0);
    expect(normalizeTopologyWheelDelta(0.1, 2, 0)).toBe(80);
  });
});

describe("zoomTopologyViewBox", () => {
  const initial = { x: -200, y: 150, width: 1600, height: 1000 };
  const anchor = { x: 175, y: 680 };

  it("reduz um passo normal para aproximadamente metade da sensibilidade anterior", () => {
    const next = zoomTopologyViewBox(initial, anchor, 100);
    expect(next.width / initial.width).toBeGreaterThan(1.05);
    expect(next.width / initial.width).toBeLessThan(1.06);
    expect(zoomTopologyViewBox(initial, anchor, 0.25).width / initial.width).toBeLessThan(1.001);
  });

  it("preserva a âncora do cursor e a proporção nos dois sentidos", () => {
    for (const delta of [-120, 120]) {
      const next = zoomTopologyViewBox(initial, anchor, delta);
      expect((anchor.x - next.x) / next.width).toBeCloseTo((anchor.x - initial.x) / initial.width);
      expect((anchor.y - next.y) / next.height).toBeCloseTo((anchor.y - initial.y) / initial.height);
      expect(next.width / next.height).toBeCloseTo(1.6);
    }
    const out = zoomTopologyViewBox(initial, anchor, 100);
    const back = zoomTopologyViewBox(out, anchor, -100);
    expect(back.x).toBeCloseTo(initial.x);
    expect(back.y).toBeCloseTo(initial.y);
    expect(back.width).toBeCloseTo(initial.width);
  });

  it("soma pequenos movimentos do trackpad de forma consistente", () => {
    let result = initial;
    for (let index = 0; index < 10; index += 1) result = zoomTopologyViewBox(result, anchor, 10);
    const single = zoomTopologyViewBox(initial, anchor, 100);
    expect(result.width).toBeCloseTo(single.width);
    expect(result.x).toBeCloseTo(single.x);
    expect(result.y).toBeCloseTo(single.y);
  });

  it("respeita os limites de zoom sem deslocar a câmera no limite", () => {
    const minimum = { ...initial, width: MIN_TOPOLOGY_VIEWBOX_WIDTH, height: 250 };
    const maximum = { ...initial, width: MAX_TOPOLOGY_VIEWBOX_WIDTH, height: 3750 };
    expect(zoomTopologyViewBox(minimum, anchor, -120)).toBe(minimum);
    expect(zoomTopologyViewBox(maximum, anchor, 120)).toBe(maximum);
    expect(zoomTopologyViewBox({ ...minimum, width: 410 }, anchor, -120).width).toBe(400);
    expect(zoomTopologyViewBox({ ...maximum, width: 5990 }, anchor, 120).width).toBe(6000);
  });

  it("não altera a vista em rolagens horizontais ou valores inválidos", () => {
    expect(zoomTopologyViewBox(initial, anchor, 0)).toBe(initial);
    expect(zoomTopologyViewBox(initial, anchor, NaN)).toBe(initial);
    expect(zoomTopologyViewBox(initial, anchor, Infinity)).toBe(initial);
  });
});
