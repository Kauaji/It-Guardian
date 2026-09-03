import { describe, expect, it } from "vitest";
import { getFloorPlanCameraPreset, getFloorPlanContentFrame } from "./FloorPlanScene3D.jsx";

describe("getFloorPlanContentFrame", () => {
  it("prioriza o conteudo ocupado sem perder a referencia do pavimento", () => {
    const frame = getFloorPlanContentFrame({
      zones: [{ floorId: "floor-a", geometry: { x: 180, y: 140, width: 720, height: 480 } }],
      objects: [{ floorId: "floor-a", x: 330, y: 290, width: 180, height: 90 }],
      cableRoutes: []
    }, "floor-a", 1280, 820);

    expect(frame.width).toBeGreaterThan(720);
    expect(frame.width).toBeLessThan(1280);
    expect(frame.height).toBeGreaterThan(480);
    expect(frame.centerX).toBe(-100);
    expect(frame.centerZ).toBe(-30);
  });
});

describe("getFloorPlanCameraPreset", () => {
  it("enquadra plantas maiores com uma distancia de camera proporcional", () => {
    const compact = getFloorPlanCameraPreset("isometric", 800, 600, 16 / 9);
    const large = getFloorPlanCameraPreset("isometric", 3200, 2200, 16 / 9);

    expect(large.position.length()).toBeGreaterThan(compact.position.length() * 3);
    expect(large.target.y).toBe(28);
  });

  it("compensa containers estreitos sem cortar a largura da planta", () => {
    const wideViewport = getFloorPlanCameraPreset("top", 1600, 700, 16 / 9);
    const narrowViewport = getFloorPlanCameraPreset("top", 1600, 700, 0.55);

    expect(narrowViewport.position.y).toBeGreaterThan(wideViewport.position.y);
    expect(narrowViewport.position.x).toBe(0);
    expect(narrowViewport.position.z).toBeCloseTo(0.01);
  });

  it("mantem vistas superior, frontal e isometrica semanticamente distintas", () => {
    const top = getFloorPlanCameraPreset("top", 1280, 820, 1.4);
    const front = getFloorPlanCameraPreset("front", 1280, 820, 1.4);
    const isometric = getFloorPlanCameraPreset("isometric", 1280, 820, 1.4);

    expect(top.position.x).toBe(0);
    expect(front.position.x).toBe(0);
    expect(front.position.z).toBeGreaterThan(0);
    expect(isometric.position.x).toBeGreaterThan(0);
    expect(isometric.position.y).toBeGreaterThan(0);
    expect(isometric.position.z).toBeGreaterThan(0);
  });

  it("mantem a camera ao redor do centro do conteudo", () => {
    const preset = getFloorPlanCameraPreset("isometric", 900, 620, 1.4, 42, -120, 80);

    expect(preset.target.x).toBe(-120);
    expect(preset.target.z).toBe(80);
    expect(preset.position.x).toBeGreaterThan(preset.target.x);
    expect(preset.position.z).toBeGreaterThan(preset.target.z);
  });
});
