import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import InventoryVisualMapView from "./InventoryVisualMapView.jsx";

vi.mock("../../api.js", () => {
  const names = ["fetchInventoryVisualMaps", "fetchInventoryVisualMap", "createInventoryVisualMap", "updateInventoryVisualMap", "deleteInventoryVisualMap",
    "createInventoryVisualMapObject", "updateInventoryVisualMapObject", "deleteInventoryVisualMapObject",
    "createInventoryVisualMapConnection", "updateInventoryVisualMapConnection", "deleteInventoryVisualMapConnection"];
  return Object.fromEntries(names.map((name) => [name, vi.fn()]));
});

// A cena three.js e coberta em InventoryVisualMapScene.test.jsx; aqui ela vira um painel de seletores.
vi.mock("./InventoryVisualMapScene.jsx", () => ({
  default: ({ map, selectedObjectId, selectedConnectionId, layers, showGrid, cameraAction, onSelectObject, onSelectConnection }) => (
    <div data-testid="scene">
      <output data-testid="scene-state">{JSON.stringify({ map: map?.id, selectedObjectId, selectedConnectionId, layers, showGrid, cameraAction })}</output>
      <button type="button" onClick={() => onSelectObject("o1")}>sel-o1</button>
      <button type="button" onClick={() => onSelectObject("o2")}>sel-o2</button>
      <button type="button" onClick={() => onSelectObject(null)}>sel-none</button>
      <button type="button" onClick={() => onSelectConnection("c1")}>sel-c1</button>
      <button type="button" onClick={() => onSelectConnection("c2")}>sel-c2</button>
    </div>
  )
}));

const maps = [{ id: "m1", name: "Térreo", objectCount: 2 }, { id: "m2", name: "Andar 2" }];
const objects = [
  { id: "o1", layer: "assets", label: "Desktop A", linkedAssetId: "d1", positionX: 1, positionY: 0, positionZ: 2 },
  { id: "o2", layer: "infrastructure", label: "Rack 1", metadata: { circuit: "C1" } }
];
const connections = [{ id: "c1", layer: "infrastructure", label: "Cabo 1", points: [{ x: 0, y: 0.08, z: 0 }, { x: 2, y: 0.08, z: 2 }] }];
const devices = [
  { id: "d1", name: "PC-01", status: "online", ip: "10.0.0.1", os: "Win", segmentName: "S1" },
  { id: "d2", hostname: "srv", assetType: "Servidor" }
];
const tabs = [{ id: "t1", name: "Aba 1" }];
let notify;

function renderView(overrides = {}) {
  notify = vi.fn();
  const props = { token: "tok", notify, devices, segments: [{ id: "s1", name: "S1" }], groups: [{ id: "g1", name: "G1" }], tabs, activeTab: tabs[0], canManage: true, ...overrides };
  return { user: userEvent.setup(), ...render(<InventoryVisualMapView {...props} />) };
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const mapNameInput = () => within(screen.getByText("Dados do mapa").closest("section")).getByRole("textbox", { name: "Nome" });
const sceneState = () => JSON.parse(screen.getByTestId("scene-state").textContent);

async function openEditing(overrides) {
  const view = renderView(overrides);
  await screen.findByText("sel-o1");
  await settle();
  await view.user.click(screen.getByRole("button", { name: "Editar" }));
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  let seq = 0;
  api.fetchInventoryVisualMaps.mockResolvedValue({ maps });
  api.fetchInventoryVisualMap.mockImplementation(async (_token, id) => ({
    map: { id, name: id === "m1" ? "Térreo" : "Andar 2", width: 30, depth: 20, scale: 1 },
    objects: id === "m1" ? objects : [],
    connections: id === "m1" ? connections : []
  }));
  api.createInventoryVisualMap.mockResolvedValue({ map: { id: "m2" } });
  api.updateInventoryVisualMap.mockImplementation(async (_token, id, payload) => ({ map: { id, ...payload } }));
  api.deleteInventoryVisualMap.mockResolvedValue({});
  api.createInventoryVisualMapObject.mockImplementation(async (_token, _map, payload) => ({ object: { id: `n${++seq}`, layer: "assets", ...payload } }));
  api.updateInventoryVisualMapObject.mockImplementation(async (_token, id, payload) => ({ object: { id, layer: "assets", ...payload } }));
  api.deleteInventoryVisualMapObject.mockResolvedValue({});
  api.createInventoryVisualMapConnection.mockImplementation(async (_token, _map, payload) => ({ connection: { id: `nc${++seq}`, ...payload } }));
  api.updateInventoryVisualMapConnection.mockImplementation(async (_token, id, payload) => ({ connection: { id, ...payload } }));
  api.deleteInventoryVisualMapConnection.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());

describe("InventoryVisualMapView — carregamento e modo", () => {
  it("carrega o mapa, seleciona o primeiro objeto e mostra o ativo vinculado", async () => {
    renderView();
    expect(await screen.findByText("Desktop A")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mapa visual 3D do inventário" })).toBeInTheDocument();
    expect(screen.getByText("Térreo", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Status: online")).toBeInTheDocument();
    expect(screen.getByText("IP: 10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("Segmento: S1")).toBeInTheDocument();
    expect(screen.getByText("Grupo: Não informado")).toBeInTheDocument();
    expect(sceneState()).toMatchObject({ map: "m1", selectedObjectId: "o1", showGrid: true });
    expect(screen.getByRole("group", { name: "Modo do mapa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Térreo (2)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Andar 2 (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar objeto" })).toBeNull();
    expect(screen.getByLabelText("Nome", { selector: ".inventory-visual-form-grid.compact input" })).toBeDisabled();
  });

  it("não permite editar sem permissão e esconde Novo mapa", async () => {
    renderView({ canManage: false });
    await screen.findByText("Desktop A");
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Novo mapa" })).toBeNull();
  });

  it("mostra o estado vazio e cria o primeiro mapa", async () => {
    api.fetchInventoryVisualMaps.mockResolvedValueOnce({ maps: [] }).mockResolvedValue({ maps: [{ id: "m1", name: "Mapa 1" }] });
    const { user } = renderView({ tabs: [], activeTab: undefined });
    expect(await screen.findByText("Nenhum mapa visual cadastrado.")).toBeInTheDocument();
    expect(screen.getByText("Sem mapa selecionado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar primeiro mapa" }));
    await settle();
    expect(api.createInventoryVisualMap).toHaveBeenCalledWith("tok", { name: "Mapa 1", environmentId: "", width: 30, depth: 20, scale: 1 });
    expect(notify).toHaveBeenCalledWith("Mapa visual criado.", "success");
  });

  it("esconde o botão de criar no estado vazio sem permissão", async () => {
    api.fetchInventoryVisualMaps.mockResolvedValue({ maps: [] });
    renderView({ canManage: false });
    await screen.findByText("Nenhum mapa visual cadastrado.");
    expect(screen.queryByRole("button", { name: "Criar primeiro mapa" })).toBeNull();
  });

  it("exibe erros de carregamento e de criação com a mensagem padrão", async () => {
    api.fetchInventoryVisualMaps.mockRejectedValue({});
    const first = renderView();
    expect(await screen.findByText("Não foi possível carregar os mapas visuais.")).toBeInTheDocument();
    first.unmount();

    api.fetchInventoryVisualMaps.mockResolvedValue({ maps });
    api.fetchInventoryVisualMap.mockRejectedValue(new Error("falha ao abrir"));
    renderView();
    expect(await screen.findByText("falha ao abrir")).toBeInTheDocument();
    expect(screen.getByText("Falha no mapa visual")).toBeInTheDocument();
  });

  it("alterna os modos, atualiza e controla a câmera e a grade", async () => {
    const { user } = renderView();
    await screen.findByText("sel-o1");
    await settle();
    await user.click(screen.getByTitle("Enquadrar mapa"));
    await user.click(screen.getByTitle("Centralizar objeto"));
    expect(sceneState().cameraAction).toEqual({ type: "selection", revision: 2 });
    await user.click(screen.getByTitle("Redefinir câmera"));
    expect(sceneState().cameraAction).toEqual({ type: "reset", revision: 3 });
    await user.click(screen.getByRole("button", { name: "Grade" }));
    expect(sceneState().showGrid).toBe(false);
    await user.click(screen.getByTitle("Atualizar mapas"));
    await settle();
    expect(api.fetchInventoryVisualMaps).toHaveBeenCalledTimes(2);
    expect(api.fetchInventoryVisualMap).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "sel-none" }));
    expect(screen.getByRole("button", { name: "Centralizar objeto" })).toBeDisabled();
    expect(screen.getByText("Selecione um objeto ou conexão no mapa.")).toBeInTheDocument();
  });

  it("filtra a seleção quando a camada do objeto é desativada", async () => {
    const { user } = renderView();
    await screen.findByText("Desktop A");
    const layerGroup = screen.getByRole("group", { name: "Camadas do mapa" });
    await user.click(within(layerGroup).getByRole("button", { name: /Ativos/ }));
    expect(sceneState().selectedObjectId).toBeNull();
    expect(sceneState().layers.assets).toBe(false);
  });
});

describe("InventoryVisualMapView — edição do mapa", () => {
  it("edita e salva os dados do mapa, sinalizando alterações não salvas", async () => {
    const { user } = await openEditing();
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
    const card = screen.getByText("Dados do mapa").closest("section");
    await user.type(within(card).getByRole("textbox", { name: "Nome" }), " B");
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    await user.selectOptions(within(card).getByLabelText("Aba"), "t1");
    await user.selectOptions(within(card).getByLabelText("Grupo"), "g1");
    await user.selectOptions(within(card).getByLabelText("Segmento"), "s1");
    await user.type(within(card).getByLabelText("Andar"), "2");
    await user.clear(within(card).getByLabelText("Largura"));
    await user.type(within(card).getByLabelText("Largura"), "40");
    await user.clear(within(card).getByLabelText("Profundidade"));
    await user.type(within(card).getByLabelText("Profundidade"), "25");
    await user.type(within(card).getByLabelText("Observacoes"), "obs");
    await user.click(within(card).getByRole("button", { name: "Salvar" }));
    await settle();
    expect(api.updateInventoryVisualMap).toHaveBeenCalledWith("tok", "m1", expect.objectContaining({
      name: "Térreo B", environmentId: "t1", groupId: "g1", segmentId: "s1", floorLabel: "2", width: 40, depth: 25, scale: 1, notes: "obs"
    }));
    expect(notify).toHaveBeenCalledWith("Mapa visual salvo.", "success");
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
  });

  it("pede confirmação para trocar de mapa e sair da edição com alterações", async () => {
    const { user } = await openEditing();
    await user.type(mapNameInput(), "x");
    window.confirm.mockReturnValueOnce(false);
    await user.selectOptions(screen.getByLabelText("Mapa"), "m2");
    expect(window.confirm).toHaveBeenCalledWith("Trocar de mapa e descartar as alterações não salvas?");
    expect(api.fetchInventoryVisualMap).toHaveBeenCalledTimes(1);
    window.confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Visualizar" }));
    expect(window.confirm).toHaveBeenLastCalledWith("Sair do modo de edição e descartar as alterações não salvas?");
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Visualizar" }));
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Mapa"), "m2");
    await settle();
    expect(api.fetchInventoryVisualMap).toHaveBeenLastCalledWith("tok", "m2");
  });

  it("registra o aviso de beforeunload apenas enquanto há alterações", async () => {
    const { user } = await openEditing();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await user.type(mapNameInput(), "x");
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it("cancela o refresh quando o usuário não confirma o descarte", async () => {
    const { user } = await openEditing();
    await user.type(mapNameInput(), "x");
    window.confirm.mockReturnValueOnce(false);
    await user.click(screen.getByTitle("Atualizar mapas"));
    expect(api.fetchInventoryVisualMaps).toHaveBeenCalledTimes(1);
  });

  it("exclui o mapa após confirmação e cria novo mapa pelo cabeçalho", async () => {
    const { user } = await openEditing();
    window.confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(api.deleteInventoryVisualMap).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await settle();
    expect(api.deleteInventoryVisualMap).toHaveBeenCalledWith("tok", "m1");
    expect(notify).toHaveBeenCalledWith("Mapa visual excluído.", "success");
    await user.click(screen.getByRole("button", { name: "Novo mapa" }));
    await settle();
    expect(api.createInventoryVisualMap).toHaveBeenCalledWith("tok", expect.objectContaining({ name: "Mapa 3", environmentId: "t1" }));
  });

  it("mostra erros de gravação com a mensagem do servidor ou a padrão", async () => {
    const { user } = await openEditing();
    api.updateInventoryVisualMap.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Não foi possível salvar o mapa visual.")).toBeInTheDocument();
    api.deleteInventoryVisualMap.mockRejectedValueOnce(new Error("sem acesso"));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("sem acesso")).toBeInTheDocument();
    api.createInventoryVisualMap.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Novo mapa" }));
    expect(await screen.findByText("Não foi possível criar o mapa visual.")).toBeInTheDocument();
  });
});

describe("InventoryVisualMapView — objetos", () => {
  it("adiciona presets de cada grupo em posições sequenciais e seleciona o novo objeto", async () => {
    const { user } = await openEditing();
    await user.click(screen.getByRole("button", { name: "Parede" }));
    await settle();
    expect(api.createInventoryVisualMapObject).toHaveBeenLastCalledWith("tok", "m1", expect.objectContaining({ presetType: "wall", layer: "structure", label: "Parede", positionX: -5.3, positionZ: -9 }));
    await user.click(screen.getByRole("button", { name: "Notebook" }));
    await settle();
    expect(api.createInventoryVisualMapObject).toHaveBeenLastCalledWith("tok", "m1", expect.objectContaining({ presetType: "notebook", layer: "assets" }));
    expect(sceneState().selectedObjectId).toBe("n2");
    expect(notify).toHaveBeenCalledWith("Objeto adicionado ao mapa.", "success");
    for (const heading of ["Estrutura", "Ativos", "Infraestrutura", "Elétrica"]) {
      expect(screen.getByText(heading, { selector: "strong" })).toBeInTheDocument();
    }
    const electrical = screen.getByText("Elétrica", { selector: "strong" }).nextElementSibling.querySelector("button");
    await user.click(electrical);
    await settle();
    expect(api.createInventoryVisualMapObject.mock.calls.at(-1)[2].layer).toBe("electrical");
  });

  it("vincula um ativo real e bloqueia os já posicionados", async () => {
    const { user } = await openEditing();
    expect(screen.getByRole("option", { name: "PC-01 (já posicionado)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar ativo" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Vincular ativo real"), "d2");
    await user.click(screen.getByRole("button", { name: "Adicionar ativo" }));
    await settle();
    expect(api.createInventoryVisualMapObject).toHaveBeenCalledWith("tok", "m1", expect.objectContaining({ presetType: "server", layer: "assets", label: "srv", linkedAssetId: "d2" }));
    expect(notify).toHaveBeenCalledWith("Ativo vinculado ao mapa.", "success");
    expect(screen.getByLabelText("Vincular ativo real")).toHaveValue("");
  });

  it("edita, ajusta posição, salva, duplica, cancela e remove o objeto", async () => {
    const { user } = await openEditing();
    const panel = screen.getByRole("button", { name: "Salvar objeto" }).closest("section");
    await user.click(within(panel).getByRole("button", { name: "X+" }));
    await user.click(within(panel).getByRole("button", { name: "X-" }));
    await user.click(within(panel).getByRole("button", { name: "Z-" }));
    await user.click(within(panel).getByRole("button", { name: "Girar" }));
    await user.type(within(panel).getByLabelText("Notas"), "n");
    await user.clear(within(panel).getByLabelText("Altura"));
    await user.type(within(panel).getByLabelText("Altura"), "2");
    await user.selectOptions(within(panel).getByLabelText("Ativo vinculado"), "");
    await user.click(within(panel).getByRole("button", { name: "Salvar objeto" }));
    await settle();
    expect(api.updateInventoryVisualMapObject).toHaveBeenCalledWith("tok", "o1", expect.objectContaining({
      linkedAssetId: null, positionX: 1, positionZ: 1.5, rotationY: 15, height: 2, notes: "n"
    }));
    await user.click(within(panel).getByRole("button", { name: "Duplicar" }));
    await settle();
    expect(api.createInventoryVisualMapObject.mock.calls.at(-1)[2]).toMatchObject({ label: "Desktop A (cópia)", linkedAssetId: null, positionX: 1.5, positionZ: 2 });
    await user.click(screen.getByRole("button", { name: "sel-o1" }));
    await user.click(screen.getByRole("button", { name: "Girar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Rotação Y")).toHaveValue(15);
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await settle();
    expect(window.confirm).toHaveBeenLastCalledWith('Remover "Desktop A" deste mapa visual?');
    expect(api.deleteInventoryVisualMapObject).toHaveBeenCalledWith("tok", "o1");
    expect(notify).toHaveBeenCalledWith("Objeto removido do mapa.", "success");
  });

  it("edita metadados de infraestrutura e confirma antes de trocar de objeto sujo", async () => {
    const { user } = await openEditing();
    await user.click(screen.getByRole("button", { name: "Girar" }));
    window.confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "sel-o2" }));
    expect(window.confirm).toHaveBeenLastCalledWith("Descartar as alterações deste objeto?");
    expect(sceneState().selectedObjectId).toBe("o1");
    await user.click(screen.getByRole("button", { name: "sel-o2" }));
    expect(sceneState().selectedObjectId).toBe("o2");
    const circuit = screen.getByLabelText("Circuito");
    expect(circuit).toHaveValue("C1");
    await user.type(circuit, "2");
    await user.click(screen.getByRole("button", { name: "Salvar objeto" }));
    await settle();
    expect(api.updateInventoryVisualMapObject.mock.calls.at(-1)[2].metadata).toEqual({ circuit: "C12" });
  });

  it("mostra erros das operações de objeto", async () => {
    const { user } = await openEditing();
    api.createInventoryVisualMapObject.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Parede" }));
    expect(await screen.findByText("Não foi possível adicionar o objeto.")).toBeInTheDocument();
    api.updateInventoryVisualMapObject.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Salvar objeto" }));
    expect(await screen.findByText("Não foi possível salvar o objeto.")).toBeInTheDocument();
    api.createInventoryVisualMapObject.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Duplicar" }));
    expect(await screen.findByText("Não foi possível duplicar o objeto.")).toBeInTheDocument();
    api.deleteInventoryVisualMapObject.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(await screen.findByText("Não foi possível remover o objeto.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Vincular ativo real"), "d2");
    api.createInventoryVisualMapObject.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Adicionar ativo" }));
    expect(await screen.findByText("Não foi possível vincular o ativo ao mapa.")).toBeInTheDocument();
  });
});

describe("InventoryVisualMapView — conexões", () => {
  it("adiciona conexões de infraestrutura e energia", async () => {
    const { user } = await openEditing();
    await user.click(screen.getByRole("button", { name: "Cabo/infra" }));
    await settle();
    expect(api.createInventoryVisualMapConnection.mock.calls.at(-1)[2]).toMatchObject({ layer: "infrastructure", label: "Cabo de rede" });
    expect(sceneState().selectedConnectionId).toBe("nc1");
    await user.click(screen.getByRole("button", { name: "Energia" }));
    await settle();
    expect(api.createInventoryVisualMapConnection.mock.calls.at(-1)[2]).toMatchObject({ layer: "electrical", label: "Linha elétrica" });
    expect(notify).toHaveBeenCalledWith("Conexão adicionada ao mapa.", "success");
  });

  it("mostra o painel da conexão em leitura e o editor no modo edição", async () => {
    const { user } = renderView();
    await screen.findByText("sel-o1");
    await settle();
    await user.click(screen.getByRole("button", { name: "sel-c1" }));
    expect(screen.getByText("Cabo 1", { selector: "strong" })).toBeInTheDocument();
    expect(document.querySelector(".inventory-visual-connection-editor")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(document.querySelector(".inventory-visual-connection-editor")).not.toBeNull();
    await user.click(screen.getByTitle("Limpar seleção"));
    expect(sceneState().selectedConnectionId).toBeNull();
  });

  it("edita, salva, descarta e remove a conexão selecionada", async () => {
    const { user } = await openEditing();
    await user.click(screen.getByRole("button", { name: "sel-c1" }));
    const editor = document.querySelector(".inventory-visual-connection-editor");
    const buttons = () => within(editor).getAllByRole("button");
    const named = (re) => buttons().find((button) => re.test(button.textContent));
    await user.click(named(/ponto/i));
    expect(document.querySelectorAll(".inventory-visual-point-row")).toHaveLength(3);
    await user.click(document.querySelector(".inventory-visual-point-row button"));
    expect(document.querySelectorAll(".inventory-visual-point-row")).toHaveLength(2);
    await user.click(document.querySelector(".inventory-visual-point-row button"));
    expect(document.querySelectorAll(".inventory-visual-point-row")).toHaveLength(2);
    const pointInput = document.querySelector(".inventory-visual-point-row input");
    await user.clear(pointInput);
    await user.type(pointInput, "5");
    const layerSelect = within(editor).getAllByRole("combobox")[0];
    await user.selectOptions(layerSelect, "electrical");
    const labelInput = within(editor).getAllByRole("textbox")[0];
    await user.type(labelInput, " x");
    const metaInput = within(editor).getAllByRole("textbox").at(-1);
    await user.type(metaInput, "m");
    await user.click(named(/salvar/i));
    await settle();
    const payload = api.updateInventoryVisualMapConnection.mock.calls.at(-1)[2];
    expect(api.updateInventoryVisualMapConnection.mock.calls.at(-1)[1]).toBe("c1");
    expect(payload.layer).toBe("electrical");
    expect(payload.points[0].x).toBe(5);
    expect(notify).toHaveBeenCalledWith("Conexão salva.", "success");
    await user.type(within(editor).getAllByRole("textbox")[0], "!");
    await user.click(named(/cancelar/i));
    await user.click(named(/remover|excluir/i));
    await settle();
    expect(api.deleteInventoryVisualMapConnection).toHaveBeenCalledWith("tok", "c1");
    expect(notify).toHaveBeenCalledWith("Conexão removida do mapa.", "success");
  });

  it("confirma antes de trocar de conexão com alterações pendentes", async () => {
    api.fetchInventoryVisualMap.mockResolvedValue({
      map: { id: "m1", name: "Térreo" },
      objects,
      connections: [...connections, { id: "c2", layer: "electrical", label: "Cabo 2", points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }] }]
    });
    const { user } = await openEditing();
    await user.click(screen.getByRole("button", { name: "sel-c1" }));
    const editor = document.querySelector(".inventory-visual-connection-editor");
    await user.type(within(editor).getAllByRole("textbox")[0], "!");
    window.confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "sel-c2" }));
    expect(window.confirm).toHaveBeenLastCalledWith("Descartar as alterações desta conexão?");
    expect(sceneState().selectedConnectionId).toBe("c1");
    await user.click(screen.getByRole("button", { name: "sel-c2" }));
    expect(sceneState().selectedConnectionId).toBe("c2");
  });

  it("mostra erros das operações de conexão", async () => {
    const { user } = await openEditing();
    api.createInventoryVisualMapConnection.mockRejectedValueOnce({});
    await user.click(screen.getByRole("button", { name: "Cabo/infra" }));
    expect(await screen.findByText("Não foi possível adicionar a conexão.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "sel-c1" }));
    const editor = document.querySelector(".inventory-visual-connection-editor");
    const named = (re) => within(editor).getAllByRole("button").find((button) => re.test(button.textContent));
    api.updateInventoryVisualMapConnection.mockRejectedValueOnce({});
    await user.click(named(/salvar/i));
    expect(await screen.findByText("Não foi possível salvar a conexão.")).toBeInTheDocument();
    api.deleteInventoryVisualMapConnection.mockRejectedValueOnce({});
    await user.click(named(/remover|excluir/i));
    expect(await screen.findByText("Não foi possível remover a conexão.")).toBeInTheDocument();
  });
});
