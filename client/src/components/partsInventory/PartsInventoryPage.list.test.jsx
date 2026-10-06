import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { discrepant, loaded, lastQuery, part, renderPage, resetApiMocks } from "./partsTestSupport.jsx";

vi.mock("../../api.js", async () => import("./partsApiMock.js"));

describe("PartsInventoryPage (lista e filtros)", () => {
  beforeEach(resetApiMocks);

  it("carrega com busca vazia, mostra estado de carregamento e resumo", async () => {
    api.fetchPartsInventory.mockResolvedValue({
      parts: [
        part("a", { quantity: 4 }),
        part("b", { quantity: 6 }),
        part("c", { inventoryState: "in_use", sourceAssetId: "asset-1" }),
        discrepant("d")
      ]
    });
    renderPage();
    expect(screen.getByText("Atualizando o inventário...")).toBeInTheDocument();
    await loaded();
    expect(api.fetchPartsInventory).toHaveBeenCalledWith("tok", { search: "", inventoryState: "" });
    const summary = document.querySelector(".parts-summary");
    expect(within(summary).getByText("Itens rastreados").textContent).toBe("Itens rastreados4");
    expect(within(summary).getByText("Unidades disponíveis").textContent).toBe("Unidades disponíveis10");
    expect(within(summary).getByText("Componentes em uso").textContent).toBe("Componentes em uso2");
    expect(within(summary).getByText("Incongruências").textContent).toBe("Incongruências1");
    expect(summary.querySelector(".summary-alerts")).toHaveClass("warning");
    expect(screen.getByText("1 incongruência(s) aguardando conferência")).toBeInTheDocument();
  });

  it("sem incongruências não mostra alerta e o resumo fica neutro", async () => {
    renderPage();
    await loaded();
    expect(document.querySelector(".parts-alert-banner")).not.toBeInTheDocument();
    expect(document.querySelector(".summary-alerts")).not.toHaveClass("warning");
  });

  it("notifica erro de carregamento", async () => {
    api.fetchPartsInventory.mockRejectedValue(new Error("falhou"));
    const { notify } = renderPage();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("falhou", "danger"));
    await loaded();
    expect(screen.getByText("Nenhuma peça encontrada")).toBeInTheDocument();
  });

  it("busca com atraso e envia o termo", async () => {
    renderPage();
    await loaded();
    const calls = api.fetchPartsInventory.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText(/Buscar peça/), { target: { value: "nvme" } });
    expect(api.fetchPartsInventory.mock.calls.length).toBe(calls);
    await waitFor(() => expect(lastQuery()).toEqual({ search: "nvme", inventoryState: "" }));
  });

  it("filtra disponibilidade pelo menu", async () => {
    renderPage();
    await loaded();
    const filter = document.querySelector(".parts-state-filter");
    expect(within(filter).getByRole("button", { name: "Todo o inventário" })).toHaveClass("active");
    fireEvent.click(within(filter).getByRole("button", { name: "Peças disponíveis" }));
    await waitFor(() => expect(lastQuery().inventoryState).toBe("available"));
    expect(within(filter).getByRole("button", { name: "Peças disponíveis" })).toHaveClass("active");
    fireEvent.click(within(filter).getByRole("button", { name: "Peças em uso" }));
    await waitFor(() => expect(lastQuery().inventoryState).toBe("in_use"));
    expect(within(filter).getByRole("button", { name: "Peças em uso" })).toHaveClass("active");
    fireEvent.click(within(filter).getByRole("button", { name: "Todo o inventário" }));
    await waitFor(() => expect(lastQuery().inventoryState).toBe(""));
  });

  it("o banner filtra incongruências e o botão limpa o filtro", async () => {
    api.fetchPartsInventory.mockResolvedValue({ parts: [discrepant("d")] });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /incongruência\(s\) aguardando conferência/ }));
    await waitFor(() => expect(lastQuery()).toEqual({ search: "", inventoryState: "in_use", discrepancyStatus: "open" }));
    fireEvent.click(await screen.findByRole("button", { name: /Limpar incongruências/ }));
    await waitFor(() => expect(lastQuery()).not.toHaveProperty("discrepancyStatus"));
    expect(screen.queryByRole("button", { name: /Limpar incongruências/ })).not.toBeInTheDocument();
  });

  it("agrupa por família e rotula cada estado de estoque", async () => {
    api.fetchPartsInventory.mockResolvedValue({
      parts: [
        part("ok", { brand: "WD", model: "SN550" }),
        part("low", { stockStatus: "low", internalCode: "COD-1" }),
        part("out", { stockStatus: "out", category: "Mouse" }),
        part("use", { inventoryState: "in_use", assignedAssetId: "asset-1" }),
        discrepant("dis", { category: "Memória", name: "16 GB" }),
        part("misc", { category: "", name: "Cabo" })
      ]
    });
    renderPage();
    await loaded();
    const card = (name) => screen.getByText(name).closest("button");
    expect(within(card("Peça ok")).getByText("Disponível", { selector: "small" })).toBeInTheDocument();
    expect(within(card("Peça ok")).getByText("WD · SN550")).toBeInTheDocument();
    expect(within(card("Peça low")).getByText("Reposição necessária")).toBeInTheDocument();
    expect(within(card("Peça low")).getByText("COD-1")).toBeInTheDocument();
    expect(card("Peça low")).toHaveClass("stock-low");
    expect(within(card("Peça out")).getByText("Sem estoque")).toBeInTheDocument();
    expect(within(card("Peça use")).getByText("Ver kit")).toBeInTheDocument();
    expect(within(card("Peça use")).getByText("Cadastro técnico")).toBeInTheDocument();
    expect(card("Peça use")).toHaveClass("state-in_use");
    expect(within(card("16 GB")).getByText("Revisar")).toBeInTheDocument();
    expect(within(card("16 GB")).getByText("Conferência necessária")).toBeInTheDocument();
    expect(card("16 GB")).toHaveClass("has-discrepancy");
    expect(within(card("Cabo")).getByText("Diversos", { selector: "small" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Memórias",
      "HD, SSD e NVMe",
      "Mouses",
      "Diversos"
    ]);
    expect([...document.querySelectorAll(".parts-family-section > header small")].map((s) => s.textContent)).toEqual([
      "1 cadastro(s) nesta família",
      "3 cadastro(s) nesta família",
      "1 cadastro(s) nesta família",
      "1 cadastro(s) nesta família"
    ]);
  });

  it("mostra o estado vazio", async () => {
    api.fetchPartsInventory.mockResolvedValue({ parts: [] });
    renderPage();
    expect(await screen.findByText("Nenhuma peça encontrada")).toBeInTheDocument();
  });

  it("concilia ativos uma única vez e recarrega quando há novidades", async () => {
    api.syncPartsFromAssets.mockResolvedValue({ summary: { created: 1, discrepancies: 0 } });
    renderPage();
    await loaded();
    await waitFor(() => expect(api.fetchPartsInventory.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(api.syncPartsFromAssets).toHaveBeenCalledTimes(1);
  });

  it("notifica erro na conciliação automática", async () => {
    api.syncPartsFromAssets.mockRejectedValue(new Error("falha sync"));
    const { notify } = renderPage();
    await waitFor(() => expect(notify).toHaveBeenCalledWith("falha sync", "danger"));
  });
});
