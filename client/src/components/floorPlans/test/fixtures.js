import { normalizeEditorData } from "../utils/editorGeometry.js";

/** Contador deterministico de ids para testes: `createTestId("object")` -> "object-1". */
export function createIdSequence() {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

export function buildDesk(overrides = {}) {
  return {
    id: "desk-1",
    floorId: "floor-1",
    objectType: "desk",
    category: "furniture",
    label: "Mesa",
    x: 200,
    y: 200,
    width: 160,
    height: 80,
    rotation: 0,
    metadata: { parentRoomId: "room-1" },
    ...overrides
  };
}

export function buildPc(overrides = {}) {
  return {
    id: "pc-1",
    floorId: "floor-1",
    objectType: "pc",
    category: "asset",
    label: "Estacao",
    x: 240,
    y: 210,
    width: 60,
    height: 40,
    rotation: 0,
    metadata: { parentRoomId: "room-1" },
    ...overrides
  };
}

/** Editor minimo e valido: um andar de 1280x820 com um comodo (100,100 500x400). */
export function buildEditor({ objects = [buildDesk(), buildPc()], ...overrides } = {}) {
  return normalizeEditorData({
    plan: { id: "plan-1", width: 1280, height: 820, gridSize: 25, snapSize: 25 },
    floors: [{ id: "floor-1", name: "Terreo", width: 1280, height: 820 }],
    zones: [{
      id: "room-1",
      floorId: "floor-1",
      zoneType: "room",
      name: "Sala",
      color: "#dbeafe",
      geometry: { x: 100, y: 100, width: 500, height: 400 }
    }],
    objects,
    connectionPoints: [],
    cableRoutes: [],
    ...overrides
  });
}
