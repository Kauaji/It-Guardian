import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { loaded, part, renderPage, resetApiMocks } from "./partsTestSupport.jsx";

vi.mock("../../api.js", async () => import("./partsApiMock.js"));

describe("PartsInventoryPage (cadastro, categorias e NF-e)", () => {
  beforeEach(resetApiMocks);

  it("cadastra uma nova peça", async () => {
    api.createPartInventoryItem.mockResolvedValue({ part: part("novo", { name: "Fonte 500W" }) });
    const { notify } = renderPage();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar peça/ }));
    const dialog = screen.getByRole("dialog", { name: "Nova peça" });
    expect(within(dialog).getByRole("heading", { name: "Nova peça" })).toBeInTheDocument();
    expect([...within(dialog).getByLabelText("Categoria").options].map((o) => o.textContent)).toEqual([
      "Selecione",
      "Armazenamento",
      "Memória"
    ]);
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Fonte 500W" } });
    fireEvent.change(within(dialog).getByLabelText("Categoria"), { target: { value: "Memória" } });
    fireEvent.change(within(dialog).getByLabelText("Fabricante"), { target: { value: "Corsair" } });
    fireEvent.change(within(dialog).getByLabelText("Modelo"), { target: { value: "CV" } });
    fireEvent.change(within(dialog).getByLabelText("Código interno"), { target: { value: "F-1" } });
    fireEvent.change(within(dialog).getByLabelText("Part number"), { target: { value: "PN" } });
    fireEvent.change(within(dialog).getByLabelText("Número de série"), { target: { value: "SN" } });
    fireEvent.change(within(dialog).getByLabelText("MAC"), { target: { value: "00:11" } });
    fireEvent.change(within(dialog).getByLabelText("Localização"), { target: { value: "A1" } });
    fireEvent.change(within(dialog).getByLabelText("Condição"), { target: { value: "used" } });
    fireEvent.change(within(dialog).getByLabelText("Estoque inicial"), { target: { value: "7" } });
    fireEvent.change(within(dialog).getByLabelText("Estoque mínimo"), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByLabelText("Valor unitário"), { target: { value: "99.9" } });
    fireEvent.change(within(dialog).getByLabelText("Unidade"), { target: { value: "cx" } });
    fireEvent.change(within(dialog).getByLabelText("Observações"), { target: { value: "obs" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar peça" }));
    await waitFor(() =>
      expect(api.createPartInventoryItem).toHaveBeenCalledWith("tok", {
        name: "Fonte 500W",
        category: "Memória",
        brand: "Corsair",
        model: "CV",
        internalCode: "F-1",
        manufacturerPartNumber: "PN",
        serialNumber: "SN",
        macAddress: "00:11",
        location: "A1",
        quantity: 7,
        minimumStock: 2,
        unitPrice: 99.9,
        unit: "cx",
        conditionStatus: "used",
        notes: "obs",
        active: true
      })
    );
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Peça salva no inventário.", "ok"));
    expect(screen.queryByRole("dialog", { name: "Nova peça" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Fonte 500W" })).toBeInTheDocument();
  });

  it("edita uma peça existente e notifica falhas ao salvar", async () => {
    const detail = part("p1", { brand: "WD" });
    api.fetchPartInventoryItem.mockResolvedValue({ part: detail });
    api.updatePartInventoryItem.mockRejectedValueOnce(new Error("duplicada")).mockResolvedValueOnce({ part: { ...detail, name: "Nova" } });
    const { notify } = renderPage();
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    fireEvent.click(await screen.findByRole("button", { name: "Editar cadastro" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Nova" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar peça" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("duplicada", "danger"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar peça" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar peça" }));
    await waitFor(() =>
      expect(api.updatePartInventoryItem).toHaveBeenLastCalledWith("tok", "p1", expect.objectContaining({ name: "Nova", brand: "WD" }))
    );
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Peça salva no inventário.", "ok"));
  });

  it("fecha o formulário por Cancelar, X e fundo", async () => {
    renderPage();
    await loaded();
    const open = () => fireEvent.click(screen.getByRole("button", { name: /Cadastrar peça/ }));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(document.querySelector(".parts-modal-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gerencia categorias: adicionar, remover e erros", async () => {
    api.createPartCategory.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("duplicada"));
    api.deletePartCategory.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("em uso"));
    const { notify } = renderPage();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Configurar categorias" }));
    const dialog = screen.getByRole("dialog", { name: "Categorias de peças" });
    expect(within(dialog).getByRole("button", { name: "Adicionar" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Nova categoria"), { target: { value: "  Refrigeração " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(api.createPartCategory).toHaveBeenCalledWith("tok", { name: "Refrigeração" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Categoria adicionada.", "ok"));
    await waitFor(() => expect(within(dialog).getByLabelText("Nova categoria")).toHaveValue(""));
    fireEvent.change(within(dialog).getByLabelText("Nova categoria"), { target: { value: "Outra" } });
    fireEvent.submit(within(dialog).getByLabelText("Nova categoria").closest("form"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("duplicada", "danger"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover Memória" }));
    await waitFor(() => expect(api.deletePartCategory).toHaveBeenCalledWith("tok", "c2"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Categoria removida da lista.", "ok"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover Memória" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("em uso", "danger"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("não envia categoria vazia e fecha pelo fundo", async () => {
    renderPage();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Configurar categorias" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nova categoria"), { target: { value: "   " } });
    fireEvent.submit(within(dialog).getByLabelText("Nova categoria").closest("form"));
    expect(api.createPartCategory).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.querySelector(".parts-modal-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("esconde ações sem permissão", async () => {
    renderPage({ permissions: {} });
    await loaded();
    expect(screen.queryByRole("button", { name: /Importar NF-e/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cadastrar peça/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurar categorias" })).not.toBeInTheDocument();
    expect(api.syncPartsFromAssets).not.toHaveBeenCalled();
  });

  it("importa NF-e: lê o XML, notifica e limpa o seletor", async () => {
    api.importPartsInvoice.mockResolvedValue({ summary: { created: 2, merged: 3 } });
    const { notify } = renderPage();
    await loaded();
    const input = document.querySelector(".parts-file-input");
    expect(input).toHaveAttribute("accept", ".xml,application/xml,text/xml");
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: /Importar NF-e/ }));
    expect(click).toHaveBeenCalled();
    const file = new File(["<nfe/>"], "nf.xml", { type: "text/xml" });
    file.text = () => Promise.resolve("<nfe/>");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(api.importPartsInvoice).toHaveBeenCalledWith("tok", "<nfe/>"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("NF-e importada: 2 cadastro(s) e 3 saldo(s) atualizados.", "ok"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Importar NF-e/ })).not.toBeDisabled());
  });

  it("ignora importação sem arquivo e notifica erro de importação", async () => {
    api.importPartsInvoice.mockRejectedValue(new Error("XML inválido"));
    const { notify } = renderPage();
    await loaded();
    const input = document.querySelector(".parts-file-input");
    fireEvent.change(input, { target: { files: [] } });
    expect(api.importPartsInvoice).not.toHaveBeenCalled();
    const file = new File(["x"], "nf.xml");
    file.text = () => Promise.resolve("x");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("XML inválido", "danger"));
  });
});
