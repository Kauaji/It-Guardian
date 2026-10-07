import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import FloorPlanScene3D from "../FloorPlanScene3D.jsx";

// Cena 3D sem WebGL: o renderer e o carregador GLB sao substituidos por dobles
// para exercitar montagem, interacao, camera e descarte em jsdom.
const trace = { renderers: [], listeners: {}, warnings: [], loads: [] };

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  class FakeRenderer {
    constructor() {
      this.domElement = document.createElement("canvas");
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.disposed = false;
      this.sizes = [];
      const add = this.domElement.addEventListener.bind(this.domElement);
      const remove = this.domElement.removeEventListener.bind(this.domElement);
      this.domElement.addEventListener = (type, handler, options) => {
        globalThis.__sceneTrace.listeners[`+${type}`] = (globalThis.__sceneTrace.listeners[`+${type}`] || 0) + 1;
        add(type, handler, options);
      };
      this.domElement.removeEventListener = (type, handler, options) => {
        globalThis.__sceneTrace.listeners[`-${type}`] = (globalThis.__sceneTrace.listeners[`-${type}`] || 0) + 1;
        remove(type, handler, options);
      };
      globalThis.__sceneTrace.renderers.push(this);
    }
    setClearColor() {}
    setPixelRatio(value) {
      this.pixelRatio = value;
    }
    setSize(width, height) {
      this.sizes.push([width, height]);
    }
    render(scene, camera) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      this.last = { scene, camera };
    }
    dispose() {
      this.disposed = true;
    }
  }
  class FakePMREM {
    fromScene() {
      return { texture: new actual.Texture() };
    }
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer, PMREMGenerator: FakePMREM };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", async () => {
  const THREE_ = await vi.importActual("three");
  class FakeGLTFLoader {
    async loadAsync(url) {
      globalThis.__sceneTrace.loads.push(url);
      if (url.includes("cabinet") || url.includes("computerMouse")) throw new Error(`404 ${url}`);
      const group = new THREE_.Group();
      group.add(new THREE_.Mesh(new THREE_.BoxGeometry(2, 3, 1), new THREE_.MeshStandardMaterial({ roughness: 0.9, metalness: 0.9 })));
      return { scene: group };
    }
  }
  return { GLTFLoader: FakeGLTFLoader };
});

let resizeCallbacks = [];

beforeAll(() => {
  globalThis.__sceneTrace = trace;
  globalThis.PointerEvent = class extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
  window.PointerEvent = globalThis.PointerEvent;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      resizeCallbacks.push(callback);
    }
    observe() {}
    disconnect() {}
  };
  const noop = () => {};
  HTMLCanvasElement.prototype.setPointerCapture = noop;
  HTMLCanvasElement.prototype.releasePointerCapture = noop;
  HTMLCanvasElement.prototype.hasPointerCapture = () => false;
  HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => noop, set: () => true });
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
  trace.listeners = {};
  trace.loads = [];
  trace.warnings = [];
  resizeCallbacks = [];
  vi.spyOn(console, "warn").mockImplementation((...args) => trace.warnings.push(String(args[0])));
});

afterAll(() => vi.restoreAllMocks());

const round = (value) => Math.round(value * 1000) / 1000;
const vec = (v) => [round(v.x), round(v.y), round(v.z)];
const wall = (id, x, y, width, height, extra = {}) => ({
  id,
  floorId: "floor-1",
  objectType: "wall",
  category: "structure",
  label: id,
  x,
  y,
  width,
  height,
  rotation: 0,
  height3d: 110,
  color: "#64748b",
  metadata: { texturePreset: "brick" },
  ...extra
});
const item = (id, objectType, category, x, y, width, height, extra = {}) => ({
  id,
  floorId: "floor-1",
  objectType,
  category,
  label: id,
  x,
  y,
  width,
  height,
  rotation: 0,
  color: "#2563eb",
  metadata: {},
  ...extra
});

const fixture = () => ({
  plan: { id: "plan-1", width: 1280, height: 820 },
  floors: [{ id: "floor-1", name: "Térreo", width: 1280, height: 820 }],
  zones: [
    {
      id: "room-1",
      floorId: "floor-1",
      zoneType: "room",
      name: "Sala",
      color: "#dbeafe",
      geometry: { x: 100, y: 100, width: 600, height: 400 },
      metadata: { floorTexture: "wood", room: { wallThickness: 10 } }
    },
    {
      id: "room-2",
      floorId: "floor-1",
      zoneType: "room",
      name: "Outra",
      color: "#fde68a",
      geometry: { x: 750, y: 100, width: 300, height: 300 },
      metadata: { floorTexture: "carpet" }
    },
    {
      id: "room-3",
      floorId: "floor-1",
      zoneType: "room",
      name: "Cerâmica",
      color: "#bbf7d0",
      geometry: { x: 750, y: 450, width: 300, height: 200 },
      metadata: { floorTexture: "ceramic" }
    },
    {
      id: "area-1",
      floorId: "floor-1",
      zoneType: "group",
      name: "Grupo",
      color: "#ef4444",
      geometry: { kind: "paint-mask", cellSize: 20, cells: ["10:10", "11:10", "12:10", "10:11"] }
    },
    {
      id: "area-2",
      floorId: "floor-1",
      zoneType: "segment",
      name: "Seg",
      color: "#22c55e",
      geometry: { kind: "paint-mask", cellSize: 20, cells: ["20:20"] }
    },
    {
      id: "zone-x",
      floorId: "floor-1",
      zoneType: "custom",
      name: "Generica",
      color: "#a78bfa",
      geometry: { x: 900, y: 700, width: 100, height: 80 }
    },
    { id: "other-floor", floorId: "floor-2", zoneType: "room", name: "Outro andar", geometry: { x: 0, y: 0, width: 100, height: 100 } }
  ],
  objects: [
    wall("wall-1", 100, 100, 600, 10),
    item("door-1", "door", "structure", 300, 100, 74, 24, {
      metadata: { parentObjectId: "wall-1", anchorType: "wall", anchorOffset: 0.4, doorType: "single", swing: "outward" },
      height3d: 96
    }),
    item("window-1", "window", "structure", 500, 100, 92, 16, {
      metadata: { parentObjectId: "wall-1", anchorType: "wall", anchorOffset: 0.8 }
    }),
    item("divider-1", "divider", "structure", 400, 300, 140, 8, { rotation: 90, metadata: {}, height3d: 82 }),
    item("door-double", "door", "structure", 200, 450, 108, 24, { metadata: { doorType: "double", swing: "inward" } }),
    item("door-sliding", "door", "structure", 320, 450, 110, 20, { metadata: { doorType: "sliding", slideDirection: "left" } }),
    item("door-pocket", "door", "structure", 450, 450, 110, 20, { metadata: { doorType: "pocket", slideDirection: "right" } }),
    item("desk-1", "desk", "furniture", 200, 200, 160, 80, { color: "#b08968", height3d: 46 }),
    item("pc-1", "pc", "asset", 230, 210, 60, 40, { metadata: { parentRoomId: "room-1", anchorObjectId: "desk-1" } }),
    item("notebook-1", "notebook", "asset", 300, 210, 50, 40, { metadata: { anchorObjectId: "desk-1" } }),
    item("printer-1", "printer", "asset", 600, 400, 58, 40),
    item("chair-1", "chair", "furniture", 250, 300, 42, 42, { color: "#64748b" }),
    item("cabinet-1", "cabinet", "furniture", 120, 380, 82, 52, { color: "#8b5e34", height3d: 96 }),
    item("shelf-1", "shelf", "furniture", 520, 150, 96, 40, { height3d: 92 }),
    item("rack-1", "rack", "asset", 640, 150, 70, 92, {
      color: "#1f2937",
      metadata: { switchInstalled: true, switchTotalPorts: 24, switchWorkingPorts: 18 }
    }),
    item("rack-2", "rack", "asset", 640, 260, 70, 92, { metadata: {} }),
    item("server-1", "server", "asset", 760, 120, 78, 88),
    item("switch-1", "switch", "asset", 860, 120, 96, 36, { color: "#0f766e" }),
    item("router-1", "router", "asset", 860, 180, 78, 44),
    item("ap-1", "access_point", "asset", 760, 260, 62, 62),
    item("camera-1", "camera", "asset", 900, 260, 54, 42),
    item("tv-1", "tv", "asset", 960, 120, 76, 34, { height3d: 58 }),
    item("tv-label", "camera", "asset", 960, 200, 76, 34, { label: "TV sala" }),
    item("strip-1", "power_strip", "power", 760, 480, 104, 28, { color: "#7c2d12", metadata: { connectableToAssets: true } }),
    item("outlet-1", "outlet", "power", 880, 480, 30, 30),
    item("ups-1", "ups", "asset", 800, 560, 58, 54),
    item("sofa-1", "sofa", "furniture", 950, 560, 126, 62),
    item("meeting-1", "meeting_table", "furniture", 760, 560, 100, 60),
    item("measure-1", "measurement", "structure", 100, 700, 200, 8),
    item("other", "desk", "furniture", 10, 10, 50, 50, { floorId: "floor-2" })
  ],
  connectionPoints: [],
  cableRoutes: [
    {
      id: "r-free",
      floorId: "floor-1",
      routeType: "network",
      color: "#2563eb",
      path: [
        { x: 100, y: 600 },
        { x: 300, y: 600 },
        { x: 300, y: 700 }
      ],
      metadata: { routeStyle: "free" }
    },
    {
      id: "r-conduit",
      floorId: "floor-1",
      routeType: "power",
      color: "#f59e0b",
      path: [
        { x: 400, y: 600 },
        { x: 600, y: 650 }
      ],
      metadata: { routeStyle: "conduit" }
    },
    {
      id: "r-channel",
      floorId: "floor-1",
      routeType: "network",
      color: "#475569",
      path: [
        { x: 700, y: 650 },
        { x: 900, y: 650 },
        { x: 950, y: 700 }
      ],
      metadata: { routeStyle: "channel" }
    },
    { id: "r-short", floorId: "floor-1", routeType: "network", path: [{ x: 1, y: 1 }] }
  ]
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const lastRender = () => trace.renderers.at(-1).last;

function indexGroups(scene) {
  const groups = new Map();
  scene.traverse((child) => {
    if (child.userData?.object && child.userData.objectId) groups.set(child.userData.objectId, child);
  });
  return groups;
}

function projectToClient(object3d, camera) {
  const world = new THREE.Vector3();
  object3d.updateWorldMatrix(true, false);
  world.setFromMatrixPosition(object3d.matrixWorld);
  world.project(camera);
  return { clientX: ((world.x + 1) / 2) * 800, clientY: ((1 - world.y) / 2) * 600 };
}

function setup(overrides = {}) {
  const calls = { select: [], move: [], grid: [] };
  const data = fixture();
  const props = {
    data,
    activeFloorId: "floor-1",
    selected: null,
    onSelect: (target) => calls.select.push(target),
    onMoveObject: (id, position) => calls.move.push([id, round(position.x), round(position.y)]),
    editable: true,
    showGrid: true,
    onGridChange: (value) => calls.grid.push(value),
    ...overrides
  };
  return { calls, data, props };
}

describe("cena 3D", () => {
  it("monta a cena com um grupo por objeto do pavimento e sem medidas", async () => {
    const { props } = setup();
    const view = render(<FloorPlanScene3D {...props} />);
    await flush();
    const { scene, camera } = lastRender();
    const groups = indexGroups(scene);
    expect(groups.has("measure-1")).toBe(false);
    expect(groups.has("other")).toBe(false);
    expect(groups.size).toBe(30 - 2);
    expect(scene.fog).toBeTruthy();
    expect(scene.environment).toBeTruthy();
    expect(camera.position.y).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("TérreoCena pronta");
    expect(view.container.querySelector(".floor-plan-studio-scene")).toHaveAttribute("data-scene-ready", "true");
    expect(scene.children.filter((child) => child.isLight)).toHaveLength(3);
    expect(scene.children.some((child) => child.type === "GridHelper" && child.visible)).toBe(true);
  });

  it("posiciona objetos com elevacao sobre mesas e o piso do comodo", async () => {
    const { props } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    const groups = indexGroups(lastRender().scene);
    expect(groups.get("pc-1").position.y).toBeGreaterThan(groups.get("desk-1").position.y);
    expect(groups.get("desk-1").position.y).toBe(10);
    expect(groups.get("printer-1").position.y).toBeGreaterThanOrEqual(5);
    expect(groups.get("divider-1").rotation.y).toBeCloseTo(Math.PI / 2);
  });

  it("carrega modelos GLB sob demanda e cai para o procedural quando falham", async () => {
    const { props } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    expect(trace.loads.some((url) => url.endsWith("quaternius/chair.glb"))).toBe(true);
    expect(trace.loads.some((url) => url.endsWith("kenney/computerScreen.glb"))).toBe(true);
    expect(trace.warnings.some((message) => message.includes("cabinet.glb"))).toBe(true);
    expect(trace.warnings.some((message) => message.includes("compostos"))).toBe(true);
    const groups = indexGroups(lastRender().scene);
    // cadeira: modelo carregado substitui o procedural (um unico filho)
    expect(groups.get("chair-1").children).toHaveLength(1);
    // armario: GLB indisponivel mantem as pecas procedurais
    expect(groups.get("cabinet-1").children.length).toBeGreaterThan(1);
    // rack com switch e portas nao e substituido
    expect(groups.get("rack-1").children.length).toBeGreaterThan(8);
    // pecas dos modelos carregados apontam para o grupo raiz
    expect(groups.get("chair-1").children[0].userData.objectRoot).toBe(groups.get("chair-1"));
  });

  it("destaca a selecao com um contorno e o remove ao limpar", async () => {
    const { props } = setup();
    const view = render(<FloorPlanScene3D {...props} />);
    await flush();
    expect(lastRender().scene.children.filter((child) => child.type === "BoxHelper")).toHaveLength(0);
    view.rerender(<FloorPlanScene3D {...props} selected={{ type: "object", id: "chair-1" }} />);
    await flush();
    expect(lastRender().scene.children.filter((child) => child.type === "BoxHelper")).toHaveLength(1);
    view.rerender(<FloorPlanScene3D {...props} selected={null} />);
    await flush();
    expect(lastRender().scene.children.filter((child) => child.type === "BoxHelper")).toHaveLength(0);
  });

  it("seleciona ao clicar e move o objeto ao arrastar", async () => {
    const { props, calls } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    const { scene, camera } = lastRender();
    const canvas = trace.renderers.at(-1).domElement;
    const target = projectToClient(indexGroups(scene).get("chair-1"), camera);
    fireEvent.pointerDown(canvas, { ...target, button: 0 });
    expect(calls.select).toEqual([{ type: "object", id: "chair-1" }]);
    fireEvent.pointerMove(canvas, { clientX: target.clientX + 40, clientY: target.clientY + 25 });
    expect(canvas.classList.contains("is-object-dragging")).toBe(true);
    fireEvent.pointerUp(canvas, { clientX: target.clientX + 40, clientY: target.clientY + 25 });
    expect(canvas.classList.contains("is-object-dragging")).toBe(false);
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0][0]).toBe("chair-1");
  });

  it("um clique sem arrastar apenas seleciona e o cancelamento restaura a posicao", async () => {
    const { props, calls } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    const { scene, camera } = lastRender();
    const canvas = trace.renderers.at(-1).domElement;
    const chair = indexGroups(scene).get("chair-1");
    const before = chair.position.clone();
    const target = projectToClient(chair, camera);
    fireEvent.pointerDown(canvas, { ...target, button: 0 });
    fireEvent.pointerUp(canvas, target);
    expect(calls.move).toEqual([]);
    fireEvent.pointerDown(canvas, { ...target, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: target.clientX + 90, clientY: target.clientY + 60 });
    expect(chair.position.equals(before)).toBe(false);
    fireEvent.pointerCancel(canvas, {});
    expect(chair.position.equals(before)).toBe(true);
    expect(calls.move).toEqual([]);
  });

  it("ignora o botao direito e cliques no vazio; nao arrasta quando nao editavel ou travado", async () => {
    const { props, calls } = setup({ editable: false });
    render(<FloorPlanScene3D {...props} />);
    await flush();
    const { scene, camera } = lastRender();
    const canvas = trace.renderers.at(-1).domElement;
    const target = projectToClient(indexGroups(scene).get("chair-1"), camera);
    fireEvent.pointerDown(canvas, { ...target, button: 2 });
    fireEvent.pointerDown(canvas, { clientX: 2, clientY: 2, button: 0 });
    expect(calls.select).toEqual([]);
    fireEvent.pointerDown(canvas, { ...target, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: target.clientX + 40, clientY: target.clientY + 25 });
    fireEvent.pointerUp(canvas, target);
    expect(calls.select.length).toBeGreaterThan(0);
    expect(calls.move).toEqual([]);
  });

  it("objeto travado e selecionado mas nao se move", async () => {
    const { props, calls, data } = setup();
    const locked = {
      ...data,
      objects: data.objects.map((object) => (object.id === "chair-1" ? { ...object, metadata: { locked: true } } : object))
    };
    render(<FloorPlanScene3D {...props} data={locked} />);
    await flush();
    const { scene, camera } = lastRender();
    const canvas = trace.renderers.at(-1).domElement;
    const target = projectToClient(indexGroups(scene).get("chair-1"), camera);
    fireEvent.pointerDown(canvas, { ...target, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: target.clientX + 40, clientY: target.clientY + 25 });
    fireEvent.pointerUp(canvas, target);
    expect(calls.select).toEqual([{ type: "object", id: "chair-1" }]);
    expect(calls.move).toEqual([]);
  });

  it("hover contorna o objeto sob o cursor e sai ao deixar o canvas", async () => {
    const { props } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    const { scene, camera } = lastRender();
    const canvas = trace.renderers.at(-1).domElement;
    fireEvent.pointerMove(canvas, projectToClient(indexGroups(scene).get("desk-1"), camera));
    expect(canvas.classList.contains("is-object-hovered")).toBe(true);
    expect(lastRender().scene.children.filter((child) => child.type === "BoxHelper")).toHaveLength(1);
    fireEvent.pointerLeave(canvas);
    expect(canvas.classList.contains("is-object-hovered")).toBe(false);
    expect(lastRender().scene.children.filter((child) => child.type === "BoxHelper")).toHaveLength(0);
    fireEvent.pointerMove(canvas, { clientX: 2, clientY: 2 });
    expect(canvas.classList.contains("is-object-hovered")).toBe(false);
  });

  it("vistas de camera, atalhos de teclado e grade", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    try {
      const { props, calls } = setup();
      const view = render(<FloorPlanScene3D {...props} />);
      await act(async () => {
        await Promise.resolve();
      });
      const positions = {};
      for (const name of ["Superior", "Frontal", "Perspectiva"]) {
        fireEvent.click(screen.getByRole("button", { name }));
        await act(async () => {
          await vi.advanceTimersByTimeAsync(800);
        });
        positions[name] = vec(lastRender().camera.position);
        expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
      }
      expect(positions.Superior[1]).toBeGreaterThan(positions.Frontal[1]);
      expect(positions.Frontal[2]).toBeGreaterThan(positions.Superior[2]);
      const region = view.container.querySelector(".floor-plan-scene-3d");
      fireEvent.keyDown(region, { key: "2" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(vec(lastRender().camera.position)).toEqual(
        positions.Superior.map((value, index) => (index === 2 ? expect.closeTo(value, 1) : expect.closeTo(value, 1)))
      );
      fireEvent.keyDown(region, { key: "f" });
      fireEvent.keyDown(region, { key: "g" });
      fireEvent.click(screen.getByRole("button", { name: /Grade/ }));
      expect(calls.grid).toEqual([false, false]);
      view.rerender(<FloorPlanScene3D {...props} showGrid={false} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(lastRender().scene.children.find((child) => child.type === "GridHelper").visible).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("acompanha o redimensionamento do container", async () => {
    const { props } = setup();
    render(<FloorPlanScene3D {...props} />);
    await flush();
    resizeCallbacks.forEach((callback) => callback([]));
    expect(trace.renderers.at(-1).sizes.length).toBeGreaterThanOrEqual(2);
  });

  it("descarta renderer, ouvintes e canvas ao desmontar e ao reconstruir a cena", async () => {
    const { props, data } = setup();
    const view = render(<FloorPlanScene3D {...props} />);
    await flush();
    const first = trace.renderers[0];
    view.rerender(<FloorPlanScene3D {...props} data={{ ...data, objects: data.objects.slice(0, 5) }} />);
    await flush();
    expect(trace.renderers).toHaveLength(2);
    expect(first.disposed).toBe(true);
    expect(document.body.contains(first.domElement)).toBe(false);
    const second = trace.renderers[1];
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    view.unmount();
    expect(second.disposed).toBe(true);
    expect(geometryDispose).toHaveBeenCalled();
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave"]) {
      expect(trace.listeners[`-${type}`]).toBeGreaterThanOrEqual(2);
    }
    // todos os ouvintes de ponteiro registrados foram removidos (picking + controles)
    const added = Object.entries(trace.listeners)
      .filter(([key]) => key.startsWith("+"))
      .reduce((sum, [, value]) => sum + value, 0);
    const removed = Object.entries(trace.listeners)
      .filter(([key]) => key.startsWith("-"))
      .reduce((sum, [, value]) => sum + value, 0);
    expect(removed).toBeGreaterThanOrEqual(added);
    cleanup();
  });

  it("modo preview nao registra picking, nao carrega modelos e nao mostra controles", async () => {
    const view = render(<FloorPlanScene3D data={fixture()} activeFloorId="floor-1" preview />);
    await flush();
    expect(trace.loads).toEqual([]);
    expect(trace.renderers.at(-1).pixelRatio).toBe(1);
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(trace.listeners["+pointermove"] || 0).toBe(0);
    expect(view.container.firstChild).toHaveClass("preview");
    view.unmount();
  });

  it("sem dados nao monta a cena", async () => {
    render(<FloorPlanScene3D data={null} activeFloorId="floor-1" />);
    await flush();
    expect(trace.renderers).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando ambiente");
  });
});
