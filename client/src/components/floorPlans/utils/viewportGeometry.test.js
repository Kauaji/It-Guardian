import { describe, expect, it } from "vitest";
import {
  clientToSvgPoint,
  getBaseViewBox,
  getFitViewBox,
  getFloorSize,
  getZoomPercent,
  panViewBox,
  zoomViewBoxAtPoint,
  zoomViewBoxCentered
} from "./viewportGeometry.js";

const floorSize = { width: 1000, height: 500 };

describe("getFloorSize", () => {
  it("usa o pavimento, depois o plano e por fim o tamanho padrao", () => {
    expect(getFloorSize({ width: 800, height: 600 }, { width: 1, height: 1 })).toEqual({ width: 800, height: 600 });
    expect(getFloorSize({}, { width: 900, height: 700 })).toEqual({ width: 900, height: 700 });
    expect(getFloorSize(null, null)).toEqual({ width: 1280, height: 820 });
  });
});

describe("zoomViewBoxAtPoint", () => {
  it("aproxima mantendo o ponto sob o cursor", () => {
    const next = zoomViewBoxAtPoint({ viewBox: null, floorSize, pointer: { x: 500, y: 250 }, factor: 0.9 });
    expect(next).toEqual({ x: 50, y: 25, width: 900, height: 450 });
  });

  it("afasta a visao alem do pavimento conforme o fator", () => {
    const next = zoomViewBoxAtPoint({ viewBox: null, floorSize, pointer: { x: 500, y: 250 }, factor: 1.14 });
    expect(next.width).toBeCloseTo(1140);
    expect(next.x).toBeCloseTo(-70);
  });

  it("fixa a posicao na folga quando a caixa fica menor que 76% do pavimento (comportamento herdado)", () => {
    // Nesse caso o limite minimo (floor - largura - folga) supera o maximo (folga),
    // entao clamp devolve sempre a folga: x = 12% da largura, y = 12% da altura.
    const next = zoomViewBoxAtPoint({ viewBox: null, floorSize, pointer: { x: 500, y: 250 }, factor: 0.5 });
    expect(next).toEqual({ x: 120, y: 60, width: 500, height: 250 });
  });

  it("limita o zoom entre 20% e 140% do pavimento", () => {
    const tooClose = zoomViewBoxAtPoint({ viewBox: { x: 0, y: 0, width: 210, height: 105 }, floorSize, pointer: { x: 0, y: 0 }, factor: 0.1 });
    expect(tooClose.width).toBe(200);
    expect(tooClose.height).toBe(100);
    const tooFar = zoomViewBoxAtPoint({ viewBox: getBaseViewBox(floorSize), floorSize, pointer: { x: 500, y: 250 }, factor: 10 });
    expect(tooFar.width).toBe(1400);
    expect(tooFar.height).toBe(700);
  });

  it("nao permite arrastar a visao alem da folga de 12%", () => {
    const next = zoomViewBoxAtPoint({ viewBox: getBaseViewBox(floorSize), floorSize, pointer: { x: 1000, y: 500 }, factor: 0.5 });
    expect(next.x).toBeLessThanOrEqual(120);
    expect(next.y).toBeLessThanOrEqual(60);
  });
});

describe("panViewBox", () => {
  it("converte o movimento do cursor para unidades do SVG", () => {
    const origin = { x: 100, y: 40, width: 900, height: 450 };
    const next = panViewBox({
      origin,
      startClient: { x: 0, y: 0 },
      currentClient: { x: 50, y: 20 },
      bounds: { width: 900, height: 450 },
      floorSize
    });
    expect(next).toEqual({ x: 50, y: 20, width: 900, height: 450 });
  });

  it("respeita os limites da folga", () => {
    const origin = { x: 0, y: 0, width: 900, height: 450 };
    const next = panViewBox({
      origin,
      startClient: { x: 0, y: 0 },
      currentClient: { x: -10000, y: -10000 },
      bounds: { width: 900, height: 450 },
      floorSize
    });
    expect(next.x).toBe(120);
    expect(next.y).toBe(60);
  });
});

describe("zoomViewBoxCentered", () => {
  it("mantem o centro e nao ultrapassa o pavimento", () => {
    const zoomedIn = zoomViewBoxCentered({ viewBox: null, floorSize, factor: 0.5 });
    expect(zoomedIn).toEqual({ x: 250, y: 125, width: 500, height: 250 });
    const zoomedOut = zoomViewBoxCentered({ viewBox: zoomedIn, floorSize, factor: 10 });
    expect(zoomedOut).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });

  it("nao reduz alem de 25% do pavimento", () => {
    const result = zoomViewBoxCentered({ viewBox: null, floorSize, factor: 0.01 });
    expect(result.width).toBe(250);
    expect(result.height).toBe(125);
  });
});

describe("getFitViewBox e getZoomPercent", () => {
  it("enquadra o pavimento com margem proporcional", () => {
    expect(getFitViewBox(floorSize)).toEqual({ x: -32, y: -32, width: 1064, height: 564 });
    expect(getFitViewBox({ width: 3000, height: 2000 }).x).toBe(-80);
  });

  it("calcula o percentual de zoom a partir da largura da caixa", () => {
    const floor = { width: 1000 };
    expect(getZoomPercent(floor, null)).toBe(100);
    expect(getZoomPercent(floor, { width: 500 })).toBe(200);
    expect(getZoomPercent(null, null)).toBe(100);
  });
});

describe("clientToSvgPoint", () => {
  it("mapeia pixels de tela para coordenadas do SVG", () => {
    const point = clientToSvgPoint({
      rect: { left: 10, top: 20, width: 200, height: 100 },
      viewBox: { x: 50, y: 50, width: 400, height: 200 },
      clientX: 110,
      clientY: 70
    });
    expect(point).toEqual({ x: 250, y: 150 });
  });
});
