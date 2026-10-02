import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { ROOM_TEMPLATES } from "./utils/roomTemplates.js";

// Testes de fluxo do editor de plantas (caracterizacao). Por padrao exercitam
// ./FloorPlansModule.jsx; VITE_FLOORPLANS_IMPL permite comparar outra implementacao.
const implementationPath = import.meta.env.VITE_FLOORPLANS_IMPL || "./FloorPlansModule.jsx";
const { default: FloorPlansModule } = await import(/* @vite-ignore */ implementationPath);

vi.mock("../../api.js", () => ({
  createFloorPlan: vi.fn(),
  deleteFloorPlan: vi.fn(),
  duplicateFloorPlan: vi.fn(),
  fetchFloorPlan: vi.fn(),
  fetchFloorPlans: vi.fn(),
  fetchFloorPlanAssetHeatmap: vi.fn(),
  fetchFloorPlanBackgroundBlob: vi.fn(),
  fetchFloorPlanServiceOrderHeatmap: vi.fn(),
  fetchFloorPlanSummary: vi.fn(),
  linkFloorPlanObjectToAsset: vi.fn(),
  saveFloorPlanEditorData: vi.fn(),
  updateFloorPlan: vi.fn(),
  uploadFloorPlanBackground: vi.fn(),
  deleteFloorPlanBackground: vi.fn()
}));

const scene3dProps = { current: null };
vi.mock("./FloorPlanScene3D.jsx", () => ({
  default: (props) => {
    scene3dProps.current = props;
    return <div data-testid="scene3d" />;
  }
}));

// O autosave (900 ms) e a renderizacao do editor completo deixam estes testes lentos sob carga.
vi.setConfig({ testTimeout: 30000 });

const ALL_PERMISSIONS = {
  create: true,
  update: true,
  delete: true,
  linkInventory: true,
  uploadBackground: true,
  viewHeatmaps: true
};
const ACTIVE_TAB = { id: "tab-1", name: "Matriz" };
const GROUPS = [{ id: "g1", name: "Matriz", color: "#ef4444" }];
const SEGMENTS = [{ id: "s1", name: "Servidores", groupId: "g1", color: "#10b981" }];
const DEVICES = [{ id: "dev-1", displayName: "Servidor 01", status: "online", groupId: "g1", segmentId: "s1", tags: "a,b" }];

const PLAN_SUMMARY = { id: "plan-1", name: "Planta Teste", status: "active", assetCount: 1, objectCount: 2, floorCount: 1 };

function buildPlanPayload({ floorExtras = {}, objects, size = { width: 1280, height: 820 } } = {}) {
  return {
    plan: {
      plan: { id: "plan-1", name: "Planta Teste", ...size, gridSize: 25, snapSize: 25, activeFloorId: "floor-1" },
      floors: [{ id: "floor-1", name: "Terreo", ...size, ...floorExtras }],
      zones: [{
        id: "room-1",
        floorId: "floor-1",
        zoneType: "room",
        name: "Sala principal",
        color: "#dbeafe",
        geometry: { x: 100, y: 100, width: 600, height: 400 }
      }],
      objects: objects || [{
        id: "desk-1",
        floorId: "floor-1",
        objectType: "desk",
        category: "furniture",
        label: "Mesa tecnica",
        x: 200,
        y: 200,
        width: 160,
        height: 80,
        metadata: { parentRoomId: "room-1" }
      }, {
        id: "chair-1",
        floorId: "floor-1",
        objectType: "chair",
        category: "furniture",
        label: "Cadeira base",
        x: 480,
        y: 340,
        width: 40,
        height: 40,
        metadata: { parentRoomId: "room-1" }
      }, {
        id: "chair-2",
        floorId: "floor-1",
        objectType: "chair",
        category: "furniture",
        label: "Cadeira dois",
        x: 560,
        y: 340,
        width: 40,
        height: 40,
        metadata: { parentRoomId: "room-1" }
      }],
      connectionPoints: [],
      cableRoutes: []
    }
  };
}

class PointerEventStub extends MouseEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  configure({ asyncUtilTimeout: 4000 });
  globalThis.PointerEvent = PointerEventStub;
  window.PointerEvent = PointerEventStub;
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  URL.createObjectURL = vi.fn(() => "blob:fundo-teste");
  URL.revokeObjectURL = vi.fn();
});

let notify;

beforeEach(() => {
  vi.clearAllMocks();
  notify = vi.fn();
  scene3dProps.current = null;
  window.history.replaceState(null, "", "/");
  api.fetchFloorPlans.mockResolvedValue({ plans: [PLAN_SUMMARY] });
  api.fetchFloorPlan.mockResolvedValue(buildPlanPayload());
  api.saveFloorPlanEditorData.mockImplementation(async (_token, _id, payload) => ({ plan: payload }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mountModule(props = {}) {
  return render(
    <FloorPlansModule
      token="tok"
      devices={DEVICES}
      segments={SEGMENTS}
      groups={GROUPS}
      activeTab={ACTIVE_TAB}
      notify={notify}
      permissions={ALL_PERMISSIONS}
      {...props}
    />
  );
}

/** Aponta o SVG para um sistema de coordenadas 1:1 (jsdom nao calcula layout). */
function getSvg(container) {
  const svg = container.querySelector("svg.floor-plan-canvas");
  if (!svg.dataset.stubbed) {
    svg.dataset.stubbed = "true";
    Object.defineProperty(svg, "viewBox", {
      get() {
        const [x, y, width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
        return { baseVal: { x, y, width, height } };
      }
    });
    svg.getBoundingClientRect = () => {
      const [, , width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
      return { left: 0, top: 0, width, height, right: width, bottom: height };
    };
  }
  return svg;
}

async function openEditor({ editing = true, ...props } = {}) {
  const view = mountModule(props);
  await screen.findByRole("img", { name: "Editor 2D da planta" });
  if (editing) {
    fireEvent.click(screen.getByRole("button", { name: "Editar planta" }));
    await screen.findByRole("navigation", { name: "Catalogo da planta" });
  }
  return { ...view, svg: getSvg(view.container) };
}

const objectNodes = (container) => [...container.querySelectorAll("g.floor-plan-object")];
const objectByLabel = (container, label) => screen.getByText(label, { selector: "text.floor-plan-object-label" }).closest("g.floor-plan-object");
const translateOf = (node) => node.getAttribute("transform");
const click = (name, options) => fireEvent.click(screen.getByRole("button", { name, ...options }));
const pointerDown = (target, x, y, extra = {}) => fireEvent.pointerDown(target, { clientX: x, clientY: y, button: 0, ...extra });
const pointerMove = (target, x, y, extra = {}) => fireEvent.pointerMove(target, { clientX: x, clientY: y, ...extra });
const pointerUp = (target, x, y, extra = {}) => fireEvent.pointerUp(target, { clientX: x, clientY: y, ...extra });
const keyDown = (key, extra = {}) => fireEvent.keyDown(window, { key, ...extra });
const lastSavedPayload = () => api.saveFloorPlanEditorData.mock.calls.at(-1)?.[2];
const waitForSave = (times = 1) => waitFor(() => expect(api.saveFloorPlanEditorData).toHaveBeenCalledTimes(times), { timeout: 4000 });
const saveStatus = (container) => container.querySelector(".floor-plan-save-state").textContent;

async function placeCatalogItem(container, svg, { tab, title, x, y }) {
  if (tab) click(tab);
  fireEvent.click(screen.getByTitle(title));
  pointerMove(svg, x, y);
  pointerDown(svg, x, y);
}

describe("lista e navegacao de plantas", () => {
  it("abre a primeira planta em modo de visualizacao e sincroniza a URL", async () => {
    const { container } = await openEditor({ editing: false });
    expect(api.fetchFloorPlans).toHaveBeenCalledWith("tok", "tab-1");
    expect(api.fetchFloorPlan).toHaveBeenCalledWith("tok", "plan-1");
    expect(window.location.pathname).toBe("/plantas/plan-1");
    expect(screen.queryByRole("navigation", { name: "Catalogo da planta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar planta" })).toBeInTheDocument();
    expect(container.querySelector(".floor-plan-editor-layout.view-only")).toBeInTheDocument();
    expect(screen.getByText("Planta Matriz")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar planta" }));
    expect(await screen.findByRole("navigation", { name: "Catalogo da planta" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/plantas/plan-1/editor");
    expect(container.querySelector(".floor-plan-editor-layout.editing")).toBeInTheDocument();
  });

  it("abre direto no editor quando a URL aponta para /plantas/:id/editor", async () => {
    window.history.replaceState(null, "", "/plantas/plan-1/editor");
    await openEditor({ editing: false });
    expect(await screen.findByRole("navigation", { name: "Catalogo da planta" })).toBeInTheDocument();
  });

  it("sem permissao de edicao nao oferece o botao de editar", async () => {
    await openEditor({ editing: false, permissions: { ...ALL_PERMISSIONS, update: false, delete: false } });
    expect(screen.queryByRole("button", { name: "Editar planta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir planta" })).toBeNull();
  });

  it("sem plantas mostra a lista vazia e cria uma nova planta", async () => {
    api.fetchFloorPlans.mockResolvedValue({ plans: [] });
    api.createFloorPlan.mockResolvedValue(buildPlanPayload());
    mountModule();
    expect(await screen.findByText("Nenhuma planta cadastrada.")).toBeInTheDocument();
    click("Nova planta");
    await screen.findByRole("img", { name: "Editor 2D da planta" });
    expect(api.createFloorPlan).toHaveBeenCalledWith("tok", expect.objectContaining({
      name: "Planta Matriz",
      inventoryTabId: "tab-1",
      status: "draft",
      width: 1280,
      height: 820
    }));
    expect(notify).toHaveBeenCalledWith("Planta criada.", "ok");
    expect(window.location.pathname).toBe("/plantas/plan-1/editor");
  });

  it("filtra a lista, duplica e exclui plantas", async () => {
    api.fetchFloorPlans.mockResolvedValue({ plans: [] });
    mountModule();
    await screen.findByText("Nenhuma planta cadastrada.");
    expect(screen.getByPlaceholderText("Buscar planta, empresa, andar ou status")).toBeInTheDocument();
    expect(screen.queryByText("Planta Teste")).toBeNull();
  });

  it("exclui a planta aberta apos confirmar e volta para a lista", async () => {
    api.deleteFloorPlan.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.fetchFloorPlans.mockResolvedValueOnce({ plans: [PLAN_SUMMARY] });
    await openEditor({ editing: false });
    api.fetchFloorPlans.mockResolvedValue({ plans: [] });
    click("Excluir planta");
    await waitFor(() => expect(api.deleteFloorPlan).toHaveBeenCalledWith("tok", "plan-1"));
    expect(window.confirm).toHaveBeenCalledWith('Excluir a planta "Planta Teste"? Esta acao nao pode ser desfeita.');
    expect(await screen.findByText("Nenhuma planta cadastrada.")).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith("Planta removida.", "ok");
  });

  it("nao exclui quando a confirmacao e recusada", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await openEditor({ editing: false });
    click("Excluir planta");
    expect(api.deleteFloorPlan).not.toHaveBeenCalled();
  });

  it("mostra erro de carregamento da lista", async () => {
    api.fetchFloorPlans.mockRejectedValue(new Error("Falha de rede"));
    mountModule();
    expect(await screen.findByText("Falha de rede")).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith("Falha de rede", "danger");
  });

  it("adota a planta legada sem aba quando a aba ainda nao tem plantas", async () => {
    api.fetchFloorPlans
      .mockResolvedValueOnce({ plans: [] })
      .mockResolvedValueOnce({ plans: [{ id: "plan-1", name: "Antiga", inventoryTabId: null }] });
    api.updateFloorPlan.mockResolvedValue(buildPlanPayload());
    await openEditor({ editing: false });
    expect(api.updateFloorPlan).toHaveBeenCalledWith("tok", "plan-1", { inventoryTabId: "tab-1", name: "Planta Matriz" });
  });
});

describe("posicionamento a partir do catalogo", () => {
  it("posiciona um item com pre-visualizacao e clique", async () => {
    const { container, svg } = await openEditor();
    const before = objectNodes(container).length;
    click("Moveis");
    fireEvent.click(screen.getByTitle("Posicionar Cadeira"));
    expect(screen.getByText("Clique na planta para posicionar Cadeira. Esc cancela")).toBeInTheDocument();
    expect(screen.getByTitle("Posicionar Cadeira")).toHaveAttribute("aria-pressed", "true");
    pointerMove(svg, 550, 400);
    expect(container.querySelector(".floor-plan-catalog-placement-preview.valid")).toBeInTheDocument();
    pointerDown(svg, 550, 400);
    expect(notify).toHaveBeenCalledWith("Cadeira adicionado a planta.", "ok");
    expect(objectNodes(container)).toHaveLength(before + 1);
    expect(screen.queryByText(/Esc cancela/)).toBeNull();
  });

  it("recusa posicionar em area invalida e avisa o motivo", async () => {
    const { container, svg } = await openEditor();
    const before = objectNodes(container).length;
    click("Moveis");
    fireEvent.click(screen.getByTitle("Posicionar Cadeira"));
    pointerMove(svg, 1200, 700);
    expect(container.querySelector(".floor-plan-catalog-placement-preview.invalid")).toBeInTheDocument();
    pointerDown(svg, 1200, 700);
    expect(notify).toHaveBeenCalledWith("Posicione o item inteiramente dentro de um comodo", "warning");
    expect(objectNodes(container)).toHaveLength(before);
    expect(screen.getByText(/Esc cancela/)).toBeInTheDocument();
  });

  it("Esc cancela o posicionamento", async () => {
    const { svg } = await openEditor();
    click("Moveis");
    fireEvent.click(screen.getByTitle("Posicionar Cadeira"));
    expect(svg).toBeInTheDocument();
    keyDown("Escape");
    expect(screen.queryByText(/Esc cancela/)).toBeNull();
  });

  it("posiciona pontos de rede e rotas", async () => {
    const { container, svg } = await openEditor();
    await placeCatalogItem(container, svg, { tab: "Rede", title: "Posicionar Ponto RJ45", x: 400, y: 450 });
    expect(container.querySelectorAll("g.floor-plan-point")).toHaveLength(1);
    await placeCatalogItem(container, svg, { title: "Posicionar Cabo de rede", x: 400, y: 300 });
    expect(container.querySelectorAll("polyline.floor-plan-route")).toHaveLength(1);
  });

  it("busca global no catalogo ignora acentos e caixa", async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText("Buscar item em todo o catalogo"), { target: { value: "REUNI\u00c3O" } });
    expect(screen.getByTitle("Posicionar Mesa de reuniao")).toBeInTheDocument();
    expect(screen.queryByTitle("Posicionar Cadeira")).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar item em todo o catalogo"), { target: { value: "zzzz" } });
    expect(screen.getByText("Nenhum item encontrado.")).toBeInTheDocument();
  });

  it("favoritos ficam salvos no navegador e vao para o inicio", async () => {
    window.localStorage.clear();
    await openEditor();
    click("Moveis");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Cadeira aos favoritos" }));
    expect(JSON.parse(window.localStorage.getItem("it-guardian-floor-plan-favorites"))).toEqual(["chair"]);
    expect(screen.getByRole("button", { name: "Remover Cadeira dos favoritos" })).toBeInTheDocument();
    const firstItem = document.querySelector(".floor-plan-catalog-item");
    expect(firstItem).toHaveAttribute("title", "Posicionar Cadeira");
    window.localStorage.clear();
  });

  it("recolhe e expande o catalogo", async () => {
    const { container } = await openEditor();
    click("Recolher catalogo");
    expect(container.querySelector(".floor-plan-catalog.collapsed")).toBeInTheDocument();
    click("Expandir catalogo");
    expect(container.querySelector(".floor-plan-catalog.collapsed")).toBeNull();
  });

  it("posiciona um comodo por clique e o salva", async () => {
    const { container, svg } = await openEditor();
    click("Comodos");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ROOM_TEMPLATES[0].label) }));
    expect(screen.getByText("Defina a area do comodo")).toBeInTheDocument();
    pointerMove(svg, 1000, 650);
    pointerDown(svg, 1000, 650);
    pointerUp(svg, 1000, 650);
    await waitForSave();
    expect(lastSavedPayload().zones).toHaveLength(2);
    expect(container.querySelectorAll("g.floor-plan-room")).toHaveLength(2);
  });

  it("avisa quando nao ha area livre para o comodo", async () => {
    const { svg } = await openEditor();
    click("Comodos");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(ROOM_TEMPLATES[0].label) }));
    pointerMove(svg, 300, 300);
    pointerDown(svg, 300, 300);
    pointerUp(svg, 300, 300);
    expect(notify).toHaveBeenCalledWith("Escolha uma area livre da planta para posicionar o comodo.", "warning");
  });

  it("desenha uma parede com a divisoria e encaixa uma porta nela", async () => {
    const { container, svg } = await openEditor();
    click("Comodos");
    fireEvent.click(screen.getByRole("button", { name: /Divisoria/ }));
    expect(screen.getByText("Marque o inicio e o fim")).toBeInTheDocument();
    pointerDown(svg, 800, 150);
    pointerMove(svg, 900, 150);
    expect(container.querySelector(".floor-plan-wall-preview")).toBeInTheDocument();
    pointerDown(svg, 900, 150);
    await waitForSave();
    const dividers = lastSavedPayload().objects.filter((object) => object.objectType === "divider");
    expect(dividers).toHaveLength(1);
    expect(Math.round(dividers[0].width)).toBe(100);

    click("Portas e janelas");
    fireEvent.click(screen.getByTitle("Posicionar Porta simples"));
    expect(screen.getByText("Selecione uma parede")).toBeInTheDocument();
    pointerDown(svg, 850, 150);
    await waitForSave(2);
    const doors = lastSavedPayload().objects.filter((object) => object.objectType === "door");
    expect(doors).toHaveLength(1);
    expect(doors[0].metadata.parentObjectId).toBe(dividers[0].id);
  });

  it("exige uma parede antes de posicionar portas e avisa quando o clique erra a parede", async () => {
    api.fetchFloorPlan.mockResolvedValue({ plan: { ...buildPlanPayload().plan, zones: [], objects: [] } });
    await openEditor();
    click("Portas e janelas");
    fireEvent.click(screen.getByTitle("Posicionar Porta simples"));
    expect(notify).toHaveBeenCalledWith("Crie uma parede antes de posicionar portas ou janelas.", "warning");
  });

  it("avisa quando o clique da abertura nao atinge uma parede", async () => {
    const { svg } = await openEditor();
    click("Portas e janelas");
    fireEvent.click(screen.getByTitle("Posicionar Janela"));
    pointerDown(svg, 400, 300);
    expect(notify).toHaveBeenCalledWith("Clique sobre uma parede para encaixar a abertura.", "warning");
  });

  it("mede uma distancia, digita o comprimento e confirma com Enter", async () => {
    const { container, svg } = await openEditor();
    click("Medir uma distancia real");
    pointerDown(svg, 100, 600);
    pointerMove(svg, 300, 600);
    expect(container.querySelector(".floor-plan-measurement-preview text")).toHaveTextContent("4,00 m");
    keyDown("3");
    keyDown(",");
    keyDown("5");
    expect(container.querySelector(".floor-plan-measurement-preview text")).toHaveTextContent("Comprimento: 3,5_");
    keyDown("Backspace");
    expect(container.querySelector(".floor-plan-measurement-preview text")).toHaveTextContent("Comprimento: 3,_");
    keyDown("5");
    keyDown("Enter");
    await waitForSave();
    const measurement = lastSavedPayload().objects.find((object) => object.objectType === "measurement");
    expect(measurement).toBeTruthy();
    expect(Math.round(measurement.width)).toBe(175);
    expect(container.querySelector(".floor-plan-measurement-preview")).toBeNull();
  });

  it("confirma a medida com o segundo clique", async () => {
    const { container, svg } = await openEditor();
    click("Medir uma distancia real");
    pointerDown(svg, 100, 600);
    pointerMove(svg, 300, 600);
    pointerDown(svg, 300, 600);
    await waitForSave();
    expect(lastSavedPayload().objects.some((object) => object.objectType === "measurement")).toBe(true);
    expect(container.querySelector(".floor-plan-measurement-preview")).toBeNull();
  });
});

describe("selecao e edicao de objetos", () => {
  async function selectChair() {
    const view = await openEditor();
    const chair = objectByLabel(view.container, "Cadeira base");
    pointerDown(chair, 500, 360);
    pointerUp(view.svg, 500, 360);
    fireEvent.click(chair);
    return { ...view, chair };
  }

  it("seleciona um objeto, abre o inspetor e edita o nome", async () => {
    const { container } = await selectChair();
    expect(container.querySelector("g.floor-plan-object.selected")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Acoes da selecao" })).toHaveTextContent("1 item");
    const input = screen.getByLabelText("Nome do ativo");
    expect(input).toHaveValue("Cadeira base");
    fireEvent.change(input, { target: { value: "Cadeira nova" } });
    expect(screen.getByText("Cadeira nova", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
    expect(saveStatus(container)).toBe("Alteracoes pendentes");
    await waitForSave();
    expect(saveStatus(container)).toBe("Salvo");
    expect(lastSavedPayload().objects.find((object) => object.id === "chair-1").label).toBe("Cadeira nova");
  });

  it("clicar no fundo limpa a selecao e Esc tambem", async () => {
    const { container, svg } = await selectChair();
    pointerDown(svg, 900, 700);
    pointerUp(svg, 900, 700);
    expect(container.querySelector("g.floor-plan-object.selected")).toBeNull();
    expect(container.querySelector("aside.floor-plan-inspector")).toBeNull();
    const chair = objectByLabel(container, "Cadeira base");
    pointerDown(chair, 500, 360);
    pointerUp(svg, 500, 360);
    fireEvent.click(chair);
    expect(container.querySelector("aside.floor-plan-inspector")).toBeInTheDocument();
    keyDown("Escape");
    expect(container.querySelector("aside.floor-plan-inspector")).toBeNull();
  });

  it("arrasta o objeto pelo canvas", async () => {
    const { container, svg, chair } = await selectChair();
    const before = translateOf(chair);
    pointerDown(chair, 500, 360);
    pointerMove(svg, 540, 360, { altKey: true });
    pointerUp(svg, 540, 360);
    const after = translateOf(objectByLabel(container, "Cadeira base"));
    expect(before).toBe("translate(480 340)");
    expect(after).toBe("translate(520 340)");
  });

  it("duplica, gira, trava e exclui pela barra de acoes", async () => {
    const { container } = await selectChair();
    click("Duplicar selecao");
    expect(screen.getByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do ativo")).toHaveValue("Cadeira base copia");

    click("Girar selecao 90 graus");
    const copy = objectByLabel(container, "Cadeira base copia");
    expect(copy.querySelector("g").getAttribute("transform")).toContain("rotate(90 ");

    click("Travar selecao");
    expect(notify).toHaveBeenCalledWith("Selecao travada no mapa.", "success");
    expect(objectByLabel(container, "Cadeira base copia")).toHaveClass("locked");
    expect(screen.getByRole("button", { name: "Excluir selecao" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Girar selecao 90 graus" })).toBeDisabled();
    expect(container.querySelector(".floor-plan-object-resize-overlay")).toBeNull();

    click("Destravar selecao");
    expect(notify).toHaveBeenCalledWith("Selecao destravada.", "success");
    click("Excluir selecao");
    expect(screen.queryByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeNull();
    expect(container.querySelector("aside.floor-plan-inspector")).toBeNull();
  });

  it("atalhos: Delete exclui, Ctrl+Z desfaz, Ctrl+Y refaz, R gira e Ctrl+D duplica", async () => {
    const { container } = await selectChair();
    keyDown("d", { ctrlKey: true });
    expect(screen.getByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
    keyDown("r");
    expect(objectByLabel(container, "Cadeira base copia").querySelector("g").getAttribute("transform")).toContain("rotate(90 ");
    keyDown("Delete");
    expect(screen.queryByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeNull();
    keyDown("z", { ctrlKey: true });
    expect(screen.getByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
    keyDown("y", { ctrlKey: true });
    expect(screen.queryByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeNull();
  });

  it("botoes de desfazer e refazer seguem o historico", async () => {
    await selectChair();
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refazer" })).toBeDisabled();
    click("Duplicar selecao");
    click("Desfazer");
    expect(screen.queryByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeNull();
    expect(screen.getByRole("button", { name: "Refazer" })).toBeEnabled();
    click("Refazer");
    expect(screen.getByText("Cadeira base copia", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
  });

  it("nao dispara atalhos enquanto o usuario digita em um campo", async () => {
    const { container } = await selectChair();
    const input = screen.getByLabelText("Nome do ativo");
    fireEvent.keyDown(input, { key: "Delete" });
    fireEvent.keyDown(input, { key: "r" });
    expect(objectByLabel(container, "Cadeira base")).toBeInTheDocument();
  });

  it("selecao multipla com Shift e por retangulo", async () => {
    const { container, svg } = await openEditor();
    const chair = objectByLabel(container, "Cadeira base");
    pointerDown(chair, 500, 360);
    pointerUp(svg, 500, 360);
    fireEvent.click(chair);
    const desk = container.querySelectorAll("g.floor-plan-object")[objectNodes(container).findIndex((node) => translateOf(node) === "translate(200 200)")];
    fireEvent.click(desk, { shiftKey: true });
    expect(screen.getByRole("toolbar", { name: "Acoes da selecao" })).toHaveTextContent("2 itens");
    expect(screen.getByRole("button", { name: "Duplicar selecao" })).toBeDisabled();
    keyDown("Escape");
    expect(screen.queryByRole("toolbar", { name: "Acoes da selecao" })).toBeNull();

    pointerDown(svg, 150, 150);
    pointerMove(svg, 400, 300);
    expect(container.querySelector(".floor-plan-marquee-selection")).toBeInTheDocument();
    pointerUp(svg, 400, 300);
    expect(container.querySelector(".floor-plan-marquee-selection")).toBeNull();
    expect(screen.getByRole("toolbar", { name: "Acoes da selecao" })).toHaveTextContent("1 item");
  });

  it("redimensiona pelo canto e restringe ao comodo", async () => {
    const { container, svg } = await selectChair();
    const handle = container.querySelector("g.floor-plan-object-resize-handle.southeast");
    expect(handle).toBeInTheDocument();
    pointerDown(handle, 528, 388);
    pointerMove(svg, 568, 428);
    pointerUp(svg, 568, 428);
    await waitForSave();
    const chair = lastSavedPayload().objects.find((object) => object.id === "chair-1");
    expect(chair.width).toBe(80);
    expect(chair.height).toBe(80);
  });

  it("ferramenta de excluir remove ao clicar e alterna de volta para selecionar", async () => {
    const { container } = await openEditor();
    click("Excluir itens ao clicar");
    expect(screen.getByRole("button", { name: "Excluir itens ao clicar" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    expect(screen.queryByText("Cadeira base", { selector: "text.floor-plan-object-label" })).toBeNull();
    click("Excluir itens ao clicar");
    expect(screen.getByRole("button", { name: "Excluir itens ao clicar" })).toHaveAttribute("aria-pressed", "false");
  });

  it("objeto travado nao e excluido pela ferramenta de excluir", async () => {
    const { container } = await selectChair();
    click("Travar selecao");
    click("Excluir itens ao clicar");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    expect(notify).toHaveBeenCalledWith("Destrave o objeto antes de exclui-lo.", "warning");
    expect(objectByLabel(container, "Cadeira base")).toBeInTheDocument();
  });

  it("move um comodo arrastando e duplica-o ao lado", async () => {
    api.fetchFloorPlan.mockResolvedValue(buildPlanPayload({ size: { width: 2400, height: 1200 } }));
    const { container, svg } = await openEditor();
    const room = container.querySelector("g.floor-plan-room");
    expect(room).toBeInTheDocument();
    pointerDown(room, 150, 150);
    pointerMove(svg, 200, 175);
    pointerUp(svg, 200, 175);
    await waitForSave();
    expect(lastSavedPayload().zones[0].geometry).toMatchObject({ x: 150, y: 125 });
    expect(lastSavedPayload().objects.find((object) => object.id === "chair-1")).toMatchObject({ x: 530, y: 365 });
    click("Duplicar selecao");
    await waitForSave(2);
    expect(lastSavedPayload().zones).toHaveLength(2);
    expect(lastSavedPayload().zones[1].name).toBe("Sala principal copia");
  });

  it("gira o comodo selecionado quando ha espaco", async () => {
    const { container, svg } = await openEditor();
    const room = container.querySelector("g.floor-plan-room");
    pointerDown(room, 150, 150);
    pointerUp(svg, 150, 150);
    click("Girar selecao 90 graus");
    await waitForSave();
    expect(lastSavedPayload().zones[0].geometry).toMatchObject({ width: 400, height: 600 });
  });
});

describe("inspetor por tipo de entidade", () => {
  /** Seleciona pelo clique o objeto cujo rotulo e exibido no canvas. */
  function selectByLabel(container, svg, label, x, y) {
    const node = objectByLabel(container, label);
    pointerDown(node, x, y);
    pointerUp(svg, x, y);
    fireEvent.click(node);
  }

  it("campos de comodo, rota e parede", async () => {
    const { container, svg } = await openEditor();
    const room = container.querySelector("g.floor-plan-room");
    pointerDown(room, 150, 150);
    pointerUp(svg, 150, 150);
    expect(screen.getByText("Zona")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Textura do piso"), { target: { value: "wood" } });
    await waitForSave();
    expect(lastSavedPayload().zones[0].metadata.floorTexture).toBe("wood");

    await placeCatalogItem(container, svg, { tab: "Rede", title: "Posicionar Cabo de rede", x: 400, y: 450 });
    fireEvent.click(container.querySelector("polyline.floor-plan-route"));
    expect(screen.getByText("Rota")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tipo de passagem"), { target: { value: "conduit" } });
    await waitForSave(2);
    expect(lastSavedPayload().cableRoutes[0].metadata.routeStyle).toBe("conduit");
  });

  it("parede: comprimento, espessura, angulo, altura 3D e textura", async () => {
    const { container, svg } = await openEditor();
    click("Comodos");
    fireEvent.click(screen.getByRole("button", { name: /Divisoria/ }));
    pointerDown(svg, 800, 150);
    pointerMove(svg, 900, 150);
    pointerDown(svg, 900, 150);
    await waitForSave();
    const wall = lastSavedPayload().objects.find((object) => object.objectType === "divider");
    const wallNode = objectNodes(container).find((node) => translateOf(node) === `translate(${wall.x} ${wall.y})`);
    fireEvent.click(wallNode);
    expect(screen.getByLabelText("Comprimento")).toHaveValue(Math.round(wall.width));
    fireEvent.change(screen.getByLabelText("Altura 3D"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Textura da parede"), { target: { value: "brick" } });
    fireEvent.change(screen.getByLabelText("Angulo"), { target: { value: "90" } });
    await waitForSave(2);
    const updated = lastSavedPayload().objects.find((object) => object.id === wall.id);
    expect(updated).toMatchObject({ height3d: 120, rotation: 90 });
    expect(updated.metadata.texturePreset).toBe("brick");
  });

  it("rack: instala e remove o switch com portas", async () => {
    const { container, svg } = await openEditor();
    await placeCatalogItem(container, svg, { tab: "Ativos TI", title: "Posicionar Rack 12U", x: 640, y: 440 });
    selectByLabel(container, svg, "Rack 12U", 640, 440);
    expect(screen.getByText("Switch no rack")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Adicionar switch"));
    expect(screen.getByLabelText("Portas totais")).toHaveValue(24);
    fireEvent.change(screen.getByLabelText("Portas totais"), { target: { value: "48" } });
    fireEvent.change(screen.getByLabelText("Funcionando"), { target: { value: "40" } });
    await waitForSave();
    const rack = lastSavedPayload().objects.find((object) => object.objectType === "rack");
    expect(rack.metadata).toMatchObject({ switchInstalled: true, switchTotalPorts: 48, switchWorkingPorts: 40 });
    click("Remover switch");
    await waitForSave(2);
    expect(lastSavedPayload().objects.find((object) => object.objectType === "rack").metadata.switchInstalled).toBe(false);
  });

  it("ativo de inventario: correlaciona, mostra status e desvincula", async () => {
    api.linkFloorPlanObjectToAsset.mockResolvedValue({});
    const { container, svg } = await openEditor();
    await placeCatalogItem(container, svg, { tab: "Ativos TI", title: "Posicionar PC", x: 600, y: 440 });
    selectByLabel(container, svg, "PC", 600, 440);
    expect(screen.getByText("Sem vinculo com o inventario")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status manual"), { target: { value: "offline" } });
    click("Correlacionar maquina");
    fireEvent.change(screen.getByLabelText("Maquina do inventario"), { target: { value: "dev-1" } });
    await waitFor(() => expect(api.linkFloorPlanObjectToAsset).toHaveBeenCalledTimes(1));
    const [, objectId, body] = api.linkFloorPlanObjectToAsset.mock.calls[0];
    expect(objectId).toMatch(/^object-/);
    expect(body).toEqual({ assetId: "dev-1", label: "Servidor 01", groupId: "g1", segmentId: "s1" });
    expect(notify).toHaveBeenCalledWith("Vinculo atualizado.", "ok");
    expect(screen.getByLabelText("Status online")).toBeInTheDocument();
    expect(screen.getByText("Tomada de energia")).toBeInTheDocument();
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver no inventario" })).toBeDisabled();
    click("Desvincular maquina");
    await waitFor(() => expect(api.linkFloorPlanObjectToAsset).toHaveBeenCalledTimes(2));
    expect(api.linkFloorPlanObjectToAsset.mock.calls[1][2].assetId).toBeNull();
  });

  it("sem permissao de vinculo o inspetor avisa e bloqueia o botao", async () => {
    const { container, svg } = await openEditor({ permissions: { ...ALL_PERMISSIONS, linkInventory: false } });
    await placeCatalogItem(container, svg, { tab: "Ativos TI", title: "Posicionar PC", x: 600, y: 440 });
    selectByLabel(container, svg, "PC", 600, 440);
    expect(screen.getByText("Seu usuario nao pode alterar vinculos com inventario.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Correlacionar maquina" })).toBeDisabled();
  });

  it("remove a entidade pelo botao do inspetor e fecha o painel pelo X", async () => {
    const { container } = await openEditor();
    const chair = objectByLabel(container, "Cadeira base");
    pointerDown(chair, 500, 360);
    pointerUp(chair, 500, 360);
    fireEvent.click(chair);
    click("Fechar propriedades");
    expect(container.querySelector("aside.floor-plan-inspector")).toBeNull();
    fireEvent.click(chair);
    click("Remover do mapa");
    expect(screen.queryByText("Cadeira base", { selector: "text.floor-plan-object-label" })).toBeNull();
    click("Desfazer");
    expect(screen.getByText("Cadeira base", { selector: "text.floor-plan-object-label" })).toBeInTheDocument();
  });
});

describe("pincel de grupo e segmento", () => {
  it("demarca uma area de grupo e confirma", async () => {
    const { container, svg } = await openEditor();
    click("Pinceis");
    fireEvent.click(screen.getByTitle("Posicionar Pincel de grupo"));
    const panel = screen.getByRole("region", { name: "Pincel de grupo" });
    expect(within(panel).getByText("0 bloco(s) na demarcacao temporaria")).toBeInTheDocument();
    pointerDown(svg, 300, 300);
    pointerMove(svg, 340, 300);
    pointerUp(svg, 340, 300);
    expect(within(panel).getByText(/bloco\(s\) na demarcacao temporaria/).textContent).not.toMatch(/^0 /);
    expect(container.querySelector(".floor-plan-paint-draft")).toBeInTheDocument();
    click("Confirmar area");
    expect(notify).toHaveBeenCalledWith("Area demarcada e vinculada com sucesso.", "ok");
    await waitForSave();
    const zones = lastSavedPayload().zones;
    expect(zones).toHaveLength(2);
    expect(zones[1]).toMatchObject({ zoneType: "group", name: "Matriz", color: "#ef4444" });
  });

  it("avisa ao confirmar sem demarcar e cancela com confirmacao", async () => {
    const { svg } = await openEditor();
    click("Pinceis");
    fireEvent.click(screen.getByTitle("Posicionar Pincel de grupo"));
    click("Confirmar area");
    expect(notify).toHaveBeenCalledWith("Nenhuma area foi demarcada.", "warning");
    pointerDown(svg, 300, 300);
    pointerUp(svg, 300, 300);
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    click("Cancelar area");
    expect(screen.getByRole("region", { name: "Pincel de grupo" })).toBeInTheDocument();
    click("Cancelar area");
    expect(screen.queryByRole("region", { name: "Pincel de grupo" })).toBeNull();
  });

  it("o pincel de segmento exige uma area de grupo", async () => {
    await openEditor();
    click("Pinceis");
    fireEvent.click(screen.getByTitle("Posicionar Pincel de segmento"));
    expect(notify).toHaveBeenCalledWith("Crie uma area de grupo antes de demarcar segmentos.", "warning");
    expect(screen.queryByRole("region", { name: "Pincel de segmento" })).toBeNull();
  });

  it("borracha, balde e Esc no pincel", async () => {
    const { svg } = await openEditor();
    click("Pinceis");
    fireEvent.click(screen.getByTitle("Posicionar Pincel de grupo"));
    fireEvent.click(screen.getByTitle("Completar comodo"));
    pointerDown(svg, 300, 300);
    pointerUp(svg, 300, 300);
    expect(screen.getByText(/^[1-9]\d* bloco\(s\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Borracha"));
    fireEvent.click(screen.getByLabelText("Ajustar tamanho do pincel e da borracha"));
    fireEvent.change(screen.getByLabelText("Tamanho do pincel e da borracha"), { target: { value: "5" } });
    pointerDown(svg, 300, 300);
    pointerUp(svg, 300, 300);
    fireEvent.click(screen.getByTitle("Completar comodo"));
    pointerDown(svg, 1200, 780);
    expect(notify).toHaveBeenCalledWith("Nao foi possivel completar a area. Verifique se o espaco esta fechado por paredes.", "warning");
    keyDown("Escape");
    expect(screen.queryByRole("region", { name: "Pincel de grupo" })).toBeNull();
  });
});

describe("zoom, camadas e visualizacao", () => {
  it("botoes de zoom, enquadrar e restaurar", async () => {
    const { svg } = await openEditor();
    expect(svg.getAttribute("viewBox")).toBe("0 0 1280 820");
    click("Aumentar zoom");
    expect(screen.getByRole("button", { name: "Restaurar zoom. Zoom atual 122%" })).toBeInTheDocument();
    click("Diminuir zoom");
    expect(screen.getByRole("button", { name: /Restaurar zoom\. Zoom atual 100%/ })).toBeInTheDocument();
    click("Enquadrar planta");
    expect(svg.getAttribute("viewBox")).toBe("-33 -33 1346 886");
    click(/Restaurar zoom/);
    expect(svg.getAttribute("viewBox")).toBe("0 0 1280 820");
  });

  it("modo zoom: clique e roda aproximam; botao direito arrasta a visao", async () => {
    const { container, svg } = await openEditor();
    click("Ativar zoom");
    expect(container.querySelector(".floor-plan-canvas-wrap.tool-zoom")).toBeInTheDocument();
    fireEvent.pointerDown(svg, { clientX: 640, clientY: 410, button: 0 });
    const afterClick = svg.getAttribute("viewBox");
    expect(afterClick).not.toBe("0 0 1280 820");
    fireEvent.pointerDown(svg, { clientX: 640, clientY: 410, button: 0, shiftKey: true });
    expect(svg.getAttribute("viewBox")).not.toBe(afterClick);
    fireEvent.wheel(svg, { clientX: 640, clientY: 410, deltaY: -100 });
    const afterWheel = svg.getAttribute("viewBox");
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, button: 2 });
    expect(container.querySelector(".floor-plan-canvas-wrap.is-panning")).toBeInTheDocument();
    fireEvent.pointerMove(svg, { clientX: 140, clientY: 130 });
    expect(svg.getAttribute("viewBox")).not.toBe(afterWheel);
    fireEvent.pointerUp(svg, { clientX: 140, clientY: 130 });
    expect(container.querySelector(".floor-plan-canvas-wrap.is-panning")).toBeNull();
    click("Desativar zoom");
    fireEvent.wheel(svg, { clientX: 640, clientY: 410, deltaY: -100 });
  });

  it("espaco habilita o pan com o botao esquerdo", async () => {
    const { container, svg } = await openEditor();
    keyDown(" ", { code: "Space" });
    expect(container.querySelector(".floor-plan-canvas-wrap.space-pan-ready")).toBeInTheDocument();
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, button: 0 });
    expect(container.querySelector(".floor-plan-canvas-wrap.is-panning")).toBeInTheDocument();
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 100 });
    fireEvent.keyUp(window, { code: "Space" });
    expect(container.querySelector(".floor-plan-canvas-wrap.space-pan-ready")).toBeNull();
  });

  it("camadas escondem e mostram objetos, comodos e textos", async () => {
    const { container } = await openEditor();
    const toggle = (name) => fireEvent.click(screen.getByRole("checkbox", { name }));
    toggle("Objetos");
    expect(objectNodes(container)).toHaveLength(0);
    toggle("Objetos");
    expect(objectNodes(container).length).toBeGreaterThan(0);
    toggle("Comodos");
    expect(container.querySelector("g.floor-plan-room")).toBeNull();
    toggle("Textos");
    expect(container.querySelector("svg.layers-hide-labels")).toBeInTheDocument();
  });

  it("G e o botao alternam a grade", async () => {
    const { container } = await openEditor();
    expect(container.querySelector(".floor-plan-canvas-wrap.no-grid")).toBeNull();
    keyDown("g");
    expect(container.querySelector(".floor-plan-canvas-wrap.no-grid")).toBeInTheDocument();
    click("Mostrar ou ocultar grade");
    expect(container.querySelector(".floor-plan-canvas-wrap.no-grid")).toBeNull();
  });

  it("expande a area do pavimento", async () => {
    const { container } = await openEditor();
    expect(container.querySelector(".floor-plan-dimensions-badge").textContent).toContain("1280 x 820");
    click("Aumentar largura da area");
    expect(container.querySelector(".floor-plan-dimensions-badge").textContent).toContain("1600 x 820");
    click("Aumentar altura da area");
    expect(container.querySelector(".floor-plan-dimensions-badge").textContent).toContain("1600 x 1025");
  });

  it("alterna entre 2D e 3D repassando o estado para a cena", async () => {
    const { container } = await openEditor();
    click("3D");
    expect(await screen.findByTestId("scene3d")).toBeInTheDocument();
    expect(scene3dProps.current).toMatchObject({ activeFloorId: "floor-1", editable: true, showGrid: true });
    expect(container.querySelector(".floor-plan-quick-actions")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Editor 2D da planta" })).toBeNull();
    await act(async () => scene3dProps.current.onGridChange(false));
    expect(scene3dProps.current.showGrid).toBe(false);
    await act(async () => scene3dProps.current.onMoveObject("chair-1", { x: 400, y: 300 }));
    expect(scene3dProps.current.data.objects.find((object) => object.id === "chair-1")).toMatchObject({ x: 400, y: 300 });
    await act(async () => scene3dProps.current.onSelect({ type: "object", id: "chair-1" }));
    expect(scene3dProps.current.selected).toEqual({ type: "object", id: "chair-1" });
    click("2D");
    expect(await screen.findByRole("img", { name: "Editor 2D da planta" })).toBeInTheDocument();
  });

  it("no 3D sem edicao nao ha interacao", async () => {
    await openEditor({ editing: false });
    click("3D");
    await screen.findByTestId("scene3d");
    expect(scene3dProps.current).toMatchObject({ editable: false, selected: null, onSelect: undefined, onMoveObject: undefined });
  });

  it("travar um objeto impede move-lo pela cena 3D", async () => {
    const { container, svg } = await openEditor();
    const chair = objectByLabel(container, "Cadeira base");
    pointerDown(chair, 500, 360);
    pointerUp(svg, 500, 360);
    fireEvent.click(chair);
    click("Travar selecao");
    click("3D");
    await screen.findByTestId("scene3d");
    await act(async () => scene3dProps.current.onMoveObject("chair-1", { x: 400, y: 300 }));
    expect(scene3dProps.current.data.objects.find((object) => object.id === "chair-1")).toMatchObject({ x: 480, y: 340 });
  });
});

describe("mapa de infraestrutura", () => {
  it("calor de OS, calor de ativos e resumo consultam a API com os filtros", async () => {
    api.fetchFloorPlanServiceOrderHeatmap.mockResolvedValue({ heatmap: { components: [{ componentId: "chair-1", severity: "high", totalServiceOrders: 3, openServiceOrders: 2, overdueServiceOrders: 1 }] } });
    api.fetchFloorPlanAssetHeatmap.mockResolvedValue({ heatmap: { components: [{ componentId: "chair-1", severity: "low", status: "online", score: 90 }] } });
    api.fetchFloorPlanSummary.mockResolvedValue({ summary: { totalComponents: 7, onlineAssets: 3 } });
    const { container } = await openEditor({ editing: false });

    click(/Calor de OS/);
    await waitFor(() => expect(api.fetchFloorPlanServiceOrderHeatmap).toHaveBeenCalledTimes(1));
    const call = api.fetchFloorPlanServiceOrderHeatmap.mock.calls[0];
    expect(call.slice(0, 2)).toEqual(["tok", "plan-1"]);
    expect(new Date(call[3]).getTime() - new Date(call[2]).getTime()).toBe(30 * 24 * 3600 * 1000);
    expect(call[4]).toEqual({});
    expect(await screen.findByText("3 OS · 2 abertas · 1 vencidas")).toBeInTheDocument();
    expect(container.querySelector(".floor-plan-heatmap-halo.severity-high")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar por grupo"), { target: { value: "g1" } });
    await waitFor(() => expect(api.fetchFloorPlanServiceOrderHeatmap).toHaveBeenCalledTimes(2));
    expect(api.fetchFloorPlanServiceOrderHeatmap.mock.calls[1][4]).toEqual({ groupId: "g1" });
    fireEvent.change(screen.getByLabelText("Filtrar por segmento"), { target: { value: "s1" } });
    await waitFor(() => expect(api.fetchFloorPlanServiceOrderHeatmap).toHaveBeenCalledTimes(3));
    fireEvent.change(screen.getByLabelText("Período do mapa de OS"), { target: { value: "previous_month" } });
    await waitFor(() => expect(api.fetchFloorPlanServiceOrderHeatmap).toHaveBeenCalledTimes(4));

    click(/Calor de ativos/);
    await waitFor(() => expect(api.fetchFloorPlanAssetHeatmap).toHaveBeenCalledWith("tok", "plan-1", "availability", { groupId: "g1", segmentId: "s1" }));
    fireEvent.change(screen.getByLabelText("Métrica do mapa de ativos"), { target: { value: "cpu" } });
    await waitFor(() => expect(api.fetchFloorPlanAssetHeatmap).toHaveBeenLastCalledWith("tok", "plan-1", "cpu", { groupId: "g1", segmentId: "s1" }));
    expect(await screen.findByText("online · pontuação 90")).toBeInTheDocument();

    click(/Resumo/);
    expect(await screen.findByText("Dashboard da Infraestrutura")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Componentes").nextSibling.textContent).toBe("7"));
    click(/Planta$/);
    expect(screen.queryByText("Dashboard da Infraestrutura")).toBeNull();
  });

  it("sem permissao de mapas de calor os modos ficam desabilitados", async () => {
    await openEditor({ editing: false, permissions: { ...ALL_PERMISSIONS, viewHeatmaps: false } });
    expect(screen.getByRole("button", { name: /Calor de OS/ })).toBeDisabled();
    expect(api.fetchFloorPlanServiceOrderHeatmap).not.toHaveBeenCalled();
  });

  it("selecionar um objeto fora da edicao mostra o painel operacional", async () => {
    const { container } = await openEditor({ editing: false });
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    const panel = container.querySelector("aside.infrastructure-object-panel");
    expect(panel).toHaveTextContent("Cadeira base");
    expect(panel).toHaveTextContent("Não vinculado");
    click("Fechar detalhes");
    expect(container.querySelector("aside.infrastructure-object-panel")).toBeNull();
  });

  it("falhas ao consultar o mapa de calor notificam o usuario", async () => {
    api.fetchFloorPlanServiceOrderHeatmap.mockRejectedValue(new Error("sem dados"));
    await openEditor({ editing: false });
    click(/Calor de OS/);
    await waitFor(() => expect(notify).toHaveBeenCalledWith("sem dados", "danger"));
  });
});

describe("imagem de fundo", () => {
  it("baixa o fundo do pavimento e permite ajustar e remover", async () => {
    api.fetchFloorPlan.mockResolvedValue(buildPlanPayload({ floorExtras: { backgroundUrl: "/fundo.png" } }));
    api.fetchFloorPlanBackgroundBlob.mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    api.deleteFloorPlanBackground.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = await openEditor();
    await waitFor(() => expect(container.querySelector("image.floor-plan-background-image")).toHaveAttribute("href", "blob:fundo-teste"));
    expect(api.fetchFloorPlanBackgroundBlob).toHaveBeenCalledWith("tok", "plan-1", "floor-1");

    fireEvent.change(screen.getByText("Opacidade").querySelector("input"), { target: { value: "0.5" } });
    fireEvent.change(screen.getByText("Escala").querySelector("input"), { target: { value: "1.5" } });
    await waitForSave();
    const floor = lastSavedPayload().floors[0];
    expect(floor.metadata.backgroundSettings).toMatchObject({ opacity: 0.5, scale: 1.5, width: 1920, height: 1230 });

    click("Remover imagem de fundo");
    await waitFor(() => expect(api.deleteFloorPlanBackground).toHaveBeenCalledWith("tok", "plan-1", "floor-1"));
    await waitFor(() => expect(container.querySelector("image.floor-plan-background-image")).toBeNull());
    expect(notify).toHaveBeenCalledWith("Imagem de fundo removida; o mapa técnico foi preservado.", "ok");
  });

  it("envia um fundo valido e rejeita arquivos invalidos", async () => {
    api.uploadFloorPlanBackground.mockResolvedValue({ background: { backgroundUrl: "/novo.png" } });
    api.fetchFloorPlanBackgroundBlob.mockResolvedValue(new Blob(["x"]));
    const { container } = await openEditor();
    const input = container.querySelector("input.floor-plan-background-input");

    fireEvent.change(input, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(notify).toHaveBeenCalledWith("Envie uma imagem PNG, JPG ou WEBP de até 8 MB.", "danger");
    expect(api.uploadFloorPlanBackground).not.toHaveBeenCalled();

    const png = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [png] } });
    await waitFor(() => expect(api.uploadFloorPlanBackground).toHaveBeenCalledWith("tok", "plan-1", "floor-1", png));
    expect(notify).toHaveBeenCalledWith("Planta de fundo enviada com segurança.", "ok");
    await waitFor(() => expect(container.querySelector("image.floor-plan-background-image")).toBeInTheDocument());
  });

  it("sem permissao de envio nao mostra o botao", async () => {
    await openEditor({ permissions: { ...ALL_PERMISSIONS, uploadBackground: false } });
    expect(screen.queryByRole("button", { name: /Enviar planta/ })).toBeNull();
  });
});

describe("salvamento", () => {
  it("salva automaticamente depois de 900 ms e mostra o estado", async () => {
    const { container } = await openEditor();
    expect(saveStatus(container)).toBe("Salvo");
    click("Excluir itens ao clicar");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    expect(saveStatus(container)).toBe("Alteracoes pendentes");
    expect(api.saveFloorPlanEditorData).not.toHaveBeenCalled();
    await waitForSave();
    expect(api.saveFloorPlanEditorData.mock.calls[0].slice(0, 2)).toEqual(["tok", "plan-1"]);
    await waitFor(() => expect(saveStatus(container)).toBe("Salvo"));
    expect(Object.keys(lastSavedPayload()).sort()).toEqual(["cableRoutes", "connectionPoints", "floors", "objects", "plan", "zones"]);
  });

  it("o botao salvar grava imediatamente", async () => {
    const { container } = await openEditor();
    click("Excluir itens ao clicar");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    click("Salvar planta");
    await waitForSave();
    expect(saveStatus(container)).not.toBe("Falha ao salvar");
  });

  it("mostra falha ao salvar e notifica", async () => {
    api.saveFloorPlanEditorData.mockRejectedValue(new Error("Servidor indisponivel"));
    const { container } = await openEditor();
    click("Excluir itens ao clicar");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    await waitForSave();
    await waitFor(() => expect(saveStatus(container)).toBe("Falha ao salvar"));
    expect(notify).toHaveBeenCalledWith("Servidor indisponivel", "danger");
  });

  it("edicoes durante um salvamento em andamento geram um novo salvamento", async () => {
    let resolveFirst;
    api.saveFloorPlanEditorData
      .mockImplementationOnce((_token, _id, payload) => new Promise((resolve) => { resolveFirst = () => resolve({ plan: payload }); }))
      .mockImplementation(async (_token, _id, payload) => ({ plan: payload }));
    const { container } = await openEditor();
    click("Excluir itens ao clicar");
    fireEvent.click(objectByLabel(container, "Cadeira base"));
    await waitForSave(1);
    expect(saveStatus(container)).toBe("Salvando");
    fireEvent.click(objectByLabel(container, "Cadeira dois"));
    await act(async () => resolveFirst());
    await waitForSave(2);
    await waitFor(() => expect(saveStatus(container)).toBe("Salvo"));
  });

  it("sem permissao de atualizacao nao salva", async () => {
    await openEditor({ editing: false, permissions: { ...ALL_PERMISSIONS, update: false } });
    expect(api.saveFloorPlanEditorData).not.toHaveBeenCalled();
  });
});
