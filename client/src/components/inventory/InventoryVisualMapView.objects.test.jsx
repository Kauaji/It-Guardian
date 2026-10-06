import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api, armApi, connections, notify, objects, openEditing, renderView, sceneState, settle
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

beforeEach(() => armApi());
afterEach(() => vi.restoreAllMocks());

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
