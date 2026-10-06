import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api, armApi, mapNameInput, maps, notify, openEditing, renderView, sceneState, settle
} from "./visualMap/visualMapTestUtils.jsx";

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

// Fluxos longos com user-event ficam lentos sob cobertura.
vi.setConfig({ testTimeout: 30000 });

beforeEach(() => armApi());
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

