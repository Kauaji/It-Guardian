import { describe, expect, it } from "vitest";
import { inventoryCollisionDetection, keepDragOverlayNearCursor } from "./dragGeometry.js";

function container(id, type, extra = {}) {
  return { id, data: { current: { type, ...extra } } };
}

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe("keepDragOverlayNearCursor", () => {
  const transform = { x: 10, y: 20, scaleX: 1, scaleY: 1 };
  const nodes = {
    activeNodeRect: { left: 100, top: 200 },
    overlayNodeRect: { width: 200, height: 100 }
  };

  it("nao altera o transform de outros tipos de arraste ou sem dados do ponteiro", () => {
    expect(keepDragOverlayNearCursor({ ...nodes, active: { data: { current: { type: "other" } } }, activatorEvent: {}, transform })).toBe(transform);
    expect(keepDragOverlayNearCursor({ ...nodes, active: { data: { current: { type: "machine" } } }, activatorEvent: null, transform })).toBe(transform);
    expect(keepDragOverlayNearCursor({ ...nodes, active: { data: { current: { type: "machine" } } }, activatorEvent: { clientX: "x" }, transform })).toBe(transform);
  });

  it("posiciona o overlay de ativo ao lado do cursor", () => {
    const result = keepDragOverlayNearCursor({
      ...nodes,
      active: { data: { current: { type: "machine" } } },
      activatorEvent: { clientX: 130, clientY: 230 },
      transform
    });
    // gap X = clamp(200*0.06, 12, 18) = 12 ; offset Y = clamp(100*0.18, 14, 24) = 18
    expect(result).toMatchObject({ x: 10 + 30 + 12, y: 20 + 30 - 18, scaleX: 1 });
  });

  it("posiciona o overlay de segmento e suporta eventos de toque", () => {
    const result = keepDragOverlayNearCursor({
      ...nodes,
      active: { data: { current: { type: "segment" } } },
      activatorEvent: { touches: [{ clientX: 120, clientY: 210 }] },
      transform
    });
    // gap X fixo 14 ; offset Y = clamp(100*0.4, 10, 18) = 18
    expect(result).toMatchObject({ x: 10 + 20 + 14, y: 20 + 10 - 18 });
  });
});

describe("inventoryCollisionDetection", () => {
  const droppableContainers = [
    container("group-a", "segment-group-drop"),
    container("sidebar-group", "sidebar-segment-group-drop"),
    container("seg-big", "segment"),
    container("seg-small", "segment"),
    container("side-1", "sidebar-segment"),
    container("side-2", "sidebar-segment")
  ];
  const droppableRects = new Map([
    ["group-a", rect(400, 0, 300, 50)],
    ["sidebar-group", rect(0, 0, 200, 40)],
    ["seg-big", rect(300, 100, 600, 600)],
    ["seg-small", rect(320, 120, 100, 100)],
    ["side-1", rect(10, 100, 180, 30)],
    ["side-2", rect(10, 140, 180, 30)]
  ]);
  const baseArgs = {
    collisionRect: rect(0, 0, 10, 10),
    droppableContainers,
    droppableRects
  };

  it("ao arrastar segmento considera apenas alvos de grupo", () => {
    const result = inventoryCollisionDetection({
      ...baseArgs,
      active: { data: { current: { type: "segment" } } },
      pointerCoordinates: { x: 500, y: 20 }
    });
    expect(result.every((item) => ["group-a", "sidebar-group"].includes(item.id))).toBe(true);
  });

  it("ao arrastar ativo perto da sidebar escolhe o item magnetico mais proximo", () => {
    const result = inventoryCollisionDetection({
      ...baseArgs,
      active: { data: { current: { type: "machine" } } },
      pointerCoordinates: { x: 100, y: 145 }
    });
    expect(result.map((item) => item.id)).toEqual(["side-2"]);
  });

  it("na area principal escolhe o menor segmento que contem o ponteiro", () => {
    const result = inventoryCollisionDetection({
      ...baseArgs,
      active: { data: { current: { type: "machine" } } },
      pointerCoordinates: { x: 350, y: 150 }
    });
    // x > 400 desativa a sidebar? nao: 350 <= 400, mas fora da zona magnetica dos itens
    expect(result.map((item) => item.id)).toEqual(["seg-small"]);
  });

  it("ignora a sidebar quando o ponteiro esta longe dela", () => {
    const result = inventoryCollisionDetection({
      ...baseArgs,
      active: { data: { current: { type: "machine" } } },
      pointerCoordinates: { x: 800, y: 600 }
    });
    expect(result.map((item) => item.id)).toEqual(["seg-big"]);
  });

  it("sem coordenadas usa o centro mais proximo entre segmentos e sidebar", () => {
    const result = inventoryCollisionDetection({
      ...baseArgs,
      active: { data: { current: { type: "machine" } } },
      pointerCoordinates: null
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => ["seg-big", "seg-small", "side-1", "side-2"].includes(item.id))).toBe(true);
  });
});
