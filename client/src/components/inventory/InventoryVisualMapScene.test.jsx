import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import InventoryVisualMapScene from "./InventoryVisualMapScene.jsx";

// Cena three.js sem WebGL: o renderer e substituido por um duble que registra a ultima cena.
const trace = { renderers: [], resize: [] };

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  class FakeRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.shadowMap = {};
      this.disposed = false;
      this.sizes = [];
      this.renders = 0;
      globalThis.__visualMapTrace.renderers.push(this);
    }
    setPixelRatio() {}
    setSize(width, height) {
      this.sizes.push([width, height]);
    }
    render(scene, camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      this.renders += 1;
      this.last = { scene, camera };
    }
    dispose() {
      this.disposed = true;
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

beforeAll(() => {
  globalThis.__visualMapTrace = trace;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      trace.resize.push(callback);
    }
    observe() {}
    disconnect() {}
  };
  globalThis.PointerEvent = class extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = "mouse";
    }
  };
  window.PointerEvent = globalThis.PointerEvent;
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
  HTMLCanvasElement.prototype.releasePointerCapture = () => {};
  HTMLCanvasElement.prototype.hasPointerCapture = () => false;
  HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 800;
    }
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return 600;
    }
  });
});

beforeEach(() => {
  trace.renderers = [];
  trace.resize = [];
});
afterEach(() => cleanup());

const map = { id: "m1", name: "Térreo", width: 30, depth: 20, scale: 1 };
const objects = [
  {
    id: "o1",
    layer: "assets",
    label: "Servidor com um nome bem longo para cortar",
    presetType: "server",
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    width: 2,
    depth: 2,
    height: 2,
    rotationY: 45
  },
  { id: "o2", layer: "structure", label: "Sala", presetType: "room", positionX: 8, positionZ: 5, width: "x", color: "#123456" },
  { id: "o3", layer: "infrastructure", label: "Rack", presetType: "rack", positionX: -8, positionZ: -5 }
];
const connections = [
  {
    id: "c1",
    layer: "infrastructure",
    label: "Cabo",
    points: [
      { x: 4, y: 0.1, z: 4 },
      { x: 6, y: 0.1, z: 6 },
      { x: 8, z: 4 }
    ],
    thickness: 3
  },
  {
    id: "c2",
    layer: "electrical",
    connectionType: "power",
    dashed: true,
    points: [
      { x: -5, y: 0.1, z: 0 },
      { x: -3, y: 0.1, z: 2 }
    ],
    color: "#ff0000"
  },
  { id: "c3", layer: "electrical", points: [{ x: 0, y: 0, z: 0 }] },
  { id: "c4", layer: "electrical" }
];

function renderScene(overrides = {}) {
  const props = {
    map,
    objects,
    connections,
    selectedObjectId: null,
    selectedConnectionId: null,
    layers: undefined,
    showGrid: true,
    cameraAction: { type: "fit", revision: 0 },
    onSelectObject: vi.fn(),
    onSelectConnection: vi.fn(),
    ...overrides
  };
  const utils = render(<InventoryVisualMapScene {...props} />);
  return { props, ...utils, rerenderScene: (next) => utils.rerender(<InventoryVisualMapScene {...props} {...next} />) };
}

const lastRenderer = () => trace.renderers.at(-1);
const children = (type) => {
  const found = [];
  lastRenderer().last.scene.traverse((child) => {
    if (child.type === type) found.push(child);
  });
  return found;
};
const pointerDown = (x = 400, y = 300) => {
  const canvas = lastRenderer().domElement;
  const event = new PointerEvent("pointerdown", { clientX: x, clientY: y, bubbles: true });
  act(() => {
    canvas.dispatchEvent(event);
  });
};

describe("InventoryVisualMapScene", () => {
  it("mostra o vazio sem mapa e não cria renderer", () => {
    renderScene({ map: null });
    expect(screen.getByText("Nenhum mapa selecionado.")).toBeInTheDocument();
    expect(trace.renderers).toHaveLength(0);
  });

  it("volta do estado vazio para a cena sem quebrar o DOM", () => {
    const { rerenderScene } = renderScene();
    rerenderScene({ map: null });
    expect(screen.getByText("Nenhum mapa selecionado.")).toBeInTheDocument();
    rerenderScene({ map });
    expect(screen.getByRole("img", { name: /Cena 3D do mapa Térreo/ }).firstChild).toBe(lastRenderer().domElement);
  });

  it("expõe a cena como imagem acessível e monta o renderer no host", () => {
    renderScene();
    const host = screen.getByRole("img", { name: /Cena 3D do mapa Térreo\. Arraste para orbitar/ });
    expect(host).toHaveAttribute("tabindex", "0");
    expect(host.firstChild).toBe(lastRenderer().domElement);
    expect(lastRenderer().sizes[0]).toEqual([800, 600]);
    renderScene({ map: { ...map, name: "" } });
    expect(screen.getByRole("img", { name: /mapa sem nome/ })).toBeInTheDocument();
  });

  it("monta piso, grade, luzes, objetos e conexões válidas", () => {
    renderScene();
    const scene = lastRenderer().last.scene;
    expect(scene.background.getHexString()).toBe("f8fafc");
    expect(children("GridHelper")).toHaveLength(1);
    expect(children("HemisphereLight")).toHaveLength(1);
    expect(children("DirectionalLight")).toHaveLength(1);
    expect(children("BoxHelper")).toHaveLength(3);
    // rotulos: 1 ativo + 2 conexoes com 2+ pontos
    expect(children("Sprite")).toHaveLength(3);
    expect(children("Line")).toHaveLength(2);
    expect(children("Line").some((line) => line.material.type === "LineDashedMaterial")).toBe(true);
    const meshes = children("Mesh");
    const room = meshes.find((mesh) => mesh.userData.objectId === "o2");
    expect(room.material.transparent).toBe(true);
    expect(room.material.color.getHexString()).toBe("123456");
    expect(room.geometry.parameters.width).toBe(1);
    const server = meshes.find((mesh) => mesh.userData.objectId === "o1");
    expect(server.position.y).toBe(1);
    expect(server.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(server.material.metalness).toBe(0.12);
  });

  it("omite a grade e filtra camadas ocultas", () => {
    renderScene({ showGrid: false, layers: { assets: false, electrical: false } });
    expect(children("GridHelper")).toHaveLength(0);
    expect(children("BoxHelper")).toHaveLength(2);
    expect(children("Line")).toHaveLength(1);
  });

  it("destaca o objeto e a conexão selecionados", () => {
    renderScene({ selectedObjectId: "o1", selectedConnectionId: "c1" });
    const helper = children("BoxHelper").find((item) => item.material.opacity === 0.95);
    expect(helper).toBeTruthy();
    expect(children("Line").find((line) => line.userData.connectionId === "c1").material.opacity).toBe(0.98);
  });

  it("seleciona objeto, conexão ou nada por pointerdown", () => {
    const first = renderScene({ connections: [] });
    pointerDown();
    expect(first.props.onSelectObject).toHaveBeenCalledWith("o1");
    pointerDown(5, 5);
    expect(first.props.onSelectObject).toHaveBeenLastCalledWith(null);
    cleanup();

    const second = renderScene({
      objects: [],
      connections: [
        {
          id: "c9",
          layer: "infrastructure",
          points: [
            { x: -3, y: 0.1, z: 0 },
            { x: 3, y: 0.1, z: 0 }
          ]
        }
      ]
    });
    pointerDown();
    expect(second.props.onSelectConnection).toHaveBeenCalledWith("c9");
  });

  it("reposiciona a câmera com as ações enquadrar, centralizar e redefinir", () => {
    const { rerenderScene } = renderScene({ selectedObjectId: "o3" });
    const camera = lastRenderer().last.camera;
    const initial = camera.position.clone();
    rerenderScene({ cameraAction: { type: "fit", revision: 1 } });
    expect(camera.position.distanceTo(initial)).toBeGreaterThan(0.01);
    expect(camera.position.x).toBeCloseTo(40.5 * 0.48);
    rerenderScene({ cameraAction: { type: "selection", revision: 2 } });
    expect(camera.position.x).not.toBeCloseTo(40.5 * 0.48);
    const afterFocus = camera.position.clone();
    rerenderScene({ cameraAction: { type: "reset", revision: 3 } });
    expect(camera.position.x).toBeCloseTo(initial.x);
    expect(camera.position.distanceTo(afterFocus)).toBeGreaterThan(0.01);
    expect(camera.far).toBe(1000);
  });

  it("ignora centralizar sem seleção visível e ações sem revisão", () => {
    const { rerenderScene } = renderScene({ selectedObjectId: "inexistente" });
    const camera = lastRenderer().last.camera;
    const before = camera.position.clone();
    rerenderScene({ cameraAction: { type: "selection", revision: 1 } });
    expect(camera.position.equals(before)).toBe(true);
    rerenderScene({ cameraAction: { type: "fit", revision: 0 } });
    expect(camera.position.equals(before)).toBe(true);
  });

  it("descarta o renderer ao desmontar e restaura a câmera ao voltar para o mesmo mapa", () => {
    const { rerenderScene, unmount } = renderScene();
    const first = lastRenderer();
    rerenderScene({ cameraAction: { type: "fit", revision: 1 } });
    const moved = first.last.camera.position.clone();
    rerenderScene({ selectedObjectId: "o1" });
    expect(first.disposed).toBe(true);
    const second = lastRenderer();
    expect(second).not.toBe(first);
    expect(second.last.camera.position.distanceTo(moved)).toBeLessThan(0.001);
    rerenderScene({ map: { ...map, id: "m2" } });
    expect(lastRenderer().last.camera.position.distanceTo(moved)).toBeGreaterThan(0.01);
    unmount();
    expect(lastRenderer().disposed).toBe(true);
  });

  it("redimensiona renderer e câmera respeitando os mínimos", () => {
    renderScene();
    const renderer = lastRenderer();
    trace.resize.at(-1)([{ contentRect: { width: 100, height: 50 } }]);
    expect(renderer.sizes.at(-1)).toEqual([320, 280]);
    trace.resize.at(-1)([{ contentRect: { width: 1000, height: 500 } }]);
    expect(renderer.sizes.at(-1)).toEqual([1000, 500]);
    expect(renderer.last.camera.aspect).toBe(2);
  });

  it("limita a grade e usa a escala do mapa", () => {
    renderScene({ map: { ...map, width: 500, depth: 500, scale: 0.01 } });
    expect(children("GridHelper")).toHaveLength(1);
  });
});
