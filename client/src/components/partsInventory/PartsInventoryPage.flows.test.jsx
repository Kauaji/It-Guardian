import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PartsInventoryPage from "./PartsInventoryPage.jsx";

const api = vi.hoisted(() => ({
  fetchPartsInventory: vi.fn(),
  fetchPartInventoryItem: vi.fn(),
  createPartInventoryItem: vi.fn(),
  updatePartInventoryItem: vi.fn(),
  createPartInventoryMovement: vi.fn(),
  fetchPartCategories: vi.fn(),
  createPartCategory: vi.fn(),
  deletePartCategory: vi.fn(),
  syncPartsFromAssets: vi.fn(),
  importPartsInvoice: vi.fn(),
  reviewPartInventoryDiscrepancy: vi.fn()
}));
vi.mock("../../api.js", () => api);

const part = (id, extra = {}) => ({
  id,
  name: `Peça ${id}`,
  category: "Armazenamento",
  inventoryState: "available",
  discrepancyStatus: "ok",
  quantity: 3,
  minimumStock: 1,
  unit: "un",
  stockStatus: "ok",
  ...extra
});
const discrepant = (id, extra = {}) =>
  part(id, {
    inventoryState: "in_use",
    sourceAssetId: "asset-1",
    discrepancyStatus: "unverified_change",
    metadata: { hardwareType: "memory" },
    ...extra
  });
const devices = [
  { id: "asset-1", alias: "PC Financeiro", hostname: "fin", tabId: "tab-1", segmentName: "Financeiro" },
  { id: "asset-2", hostname: "host-2" }
];
const allPermissions = {
  create: true,
  update: true,
  moveStock: true,
  importInvoice: true,
  manageCategories: true,
  reconcileHardware: true
};

function renderPage(props = {}) {
  const notify = vi.fn();
  const onOpenAsset = vi.fn();
  const utils = render(
    <PartsInventoryPage token="tok" notify={notify} devices={devices} permissions={allPermissions} onOpenAsset={onOpenAsset} {...props} />
  );
  return { notify, onOpenAsset, ...utils };
}
const loaded = () => waitFor(() => expect(screen.queryByText("Atualizando o inventário...")).not.toBeInTheDocument());
const lastQuery = () => api.fetchPartsInventory.mock.calls.at(-1)[1];

describe("PartsInventoryPage (fluxos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPartsInventory.mockResolvedValue({ parts: [part("p1")] });
    api.fetchPartCategories.mockResolvedValue({
      categories: [
        { id: "c1", name: "Armazenamento", color: "#2563eb" },
        { id: "c2", name: "Memória", color: "#0891b2" }
      ]
    });
    api.syncPartsFromAssets.mockResolvedValue({ summary: { created: 0, discrepancies: 0 } });
  });

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

  it("abre o inspetor de uma peça disponível e permite editar o cadastro", async () => {
    const detail = part("p1", {
      name: "SSD detalhado",
      internalCode: "",
      serialNumber: "",
      macAddress: "AA:BB",
      location: "Prateleira 2",
      supplierName: "Fornecedor X",
      assignedAssetId: "asset-2",
      movements: []
    });
    api.fetchPartInventoryItem.mockResolvedValue({ part: detail });
    renderPage();
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    expect(await screen.findByRole("heading", { name: "SSD detalhado" })).toBeInTheDocument();
    expect(api.fetchPartInventoryItem).toHaveBeenCalledWith("tok", "p1");
    const inspector = document.querySelector(".part-inspector");
    expect(document.querySelector(".parts-inventory-page")).toHaveClass("has-inspector");
    const text = inspector.textContent;
    for (const expected of [
      "Disponível",
      "3 un",
      "p1",
      "AA:BB",
      "Prateleira 2",
      "host-2",
      "Fornecedor X",
      "Nenhuma movimentação registrada."
    ]) {
      expect(text).toContain(expected);
    }
    fireEvent.click(within(inspector).getByRole("button", { name: "Editar cadastro" }));
    expect(screen.getByRole("dialog", { name: "Editar peça" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("SSD detalhado");
    expect(screen.queryByLabelText("Estoque inicial")).not.toBeInTheDocument();
    fireEvent.click(within(inspector).getByRole("button", { name: "Fechar" }));
    expect(document.querySelector(".part-inspector")).not.toBeInTheDocument();
  });

  it("inspetor sem dados opcionais usa rótulos padrão e esconde edição de peças do agente", async () => {
    api.fetchPartInventoryItem.mockResolvedValue({
      part: part("p1", { category: "", source: "agent", quantity: 2, serialNumber: "", location: "" })
    });
    renderPage();
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    const inspector = await waitFor(() => {
      const el = document.querySelector(".part-inspector");
      expect(el).toBeInTheDocument();
      return el;
    });
    expect(within(inspector).getByText("Peça", { selector: "span" })).toBeInTheDocument();
    expect(within(inspector).getByText("—")).toBeInTheDocument();
    expect(within(inspector).getByText("Não informada")).toBeInTheDocument();
    expect(within(inspector).getByText("Não vinculado")).toBeInTheDocument();
    expect(within(inspector).queryByText("Fornecedor")).not.toBeInTheDocument();
    expect(within(inspector).queryByRole("button", { name: "Editar cadastro" })).not.toBeInTheDocument();
  });

  it("notifica erro ao abrir a peça", async () => {
    api.fetchPartInventoryItem.mockRejectedValue(new Error("indisponível"));
    const { notify } = renderPage();
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("indisponível", "danger"));
    expect(document.querySelector(".part-inspector")).not.toBeInTheDocument();
  });

  it("registra movimentação de estoque e mostra o histórico", async () => {
    const detail = part("p1", {
      movements: [
        {
          id: "m1",
          movementType: "receipt",
          quantity: 2,
          previousQuantity: 1,
          resultingQuantity: 3,
          createdAt: "2026-09-01T10:00:00Z",
          serviceOrderNumber: "OS-7",
          assetId: "asset-1",
          notes: "Lote 5"
        },
        {
          id: "m2",
          movementType: "consumption",
          quantity: 1,
          previousQuantity: 3,
          resultingQuantity: 2,
          createdAt: "2026-09-02T10:00:00Z"
        },
        { id: "m3", movementType: "custom", quantity: 1, previousQuantity: 2, resultingQuantity: 1, createdAt: "2026-09-03T10:00:00Z" }
      ]
    });
    api.fetchPartInventoryItem.mockResolvedValue({ part: detail });
    api.createPartInventoryMovement.mockResolvedValue({ part: { ...detail, name: "Atualizada" } });
    const { notify } = renderPage({
      serviceOrders: [
        { id: "os1", number: "OS-1", title: "Aberta" },
        { id: "os2", number: "OS-2", title: "Fechada", status: "closed" },
        { id: "os3", number: "OS-3", title: "Encerrada", closedAt: "2026-01-01" }
      ]
    });
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    const history = await waitFor(() => {
      const el = document.querySelector(".part-history");
      expect(el).toBeInTheDocument();
      return el;
    });
    expect(within(history).getByText("Entrada · 2 un")).toBeInTheDocument();
    expect(within(history).getByText("OS OS-7")).toBeInTheDocument();
    expect(within(history).getByText("PC Financeiro")).toBeInTheDocument();
    expect(within(history).getByText("Lote 5")).toBeInTheDocument();
    expect(within(history).getByText("Consumo · 1 un")).toBeInTheDocument();
    expect(within(history).getByText("custom · 1 un")).toBeInTheDocument();
    expect(history.querySelectorAll(".movement-icon")[0].textContent).toBe("+");
    expect(history.querySelectorAll(".movement-icon")[1].textContent).toBe("−");
    expect(within(history).getAllByText(/saldo/)[0].textContent).toMatch(/saldo 1 → 3$/);
    const form = document.querySelector(".part-movement-form");
    expect(within(form).getByLabelText("Operação")).toHaveValue("consumption");
    expect([...within(form).getByLabelText("Operação").options].map((o) => o.textContent)).toEqual([
      "Entrada",
      "Consumo",
      "Retorno",
      "Ajuste de saldo",
      "Designação",
      "Desvinculação"
    ]);
    expect([...within(form).getByLabelText("Ordem de Serviço").options].map((o) => o.textContent)).toEqual(["Sem OS", "OS-1 · Aberta"]);
    expect([...within(form).getByLabelText("Ativo").options].map((o) => o.textContent)).toEqual(["Sem ativo", "PC Financeiro", "host-2"]);
    fireEvent.change(within(form).getByLabelText("Operação"), { target: { value: "return" } });
    fireEvent.change(within(form).getByLabelText("Quantidade"), { target: { value: "4" } });
    fireEvent.change(within(form).getByLabelText("Ativo"), { target: { value: "asset-1" } });
    fireEvent.change(within(form).getByLabelText("Ordem de Serviço"), { target: { value: "os1" } });
    fireEvent.change(within(form).getByLabelText("Observação"), { target: { value: "Devolvida" } });
    const loads = api.fetchPartsInventory.mock.calls.length;
    fireEvent.click(within(form).getByRole("button", { name: "Registrar movimentação" }));
    await waitFor(() =>
      expect(api.createPartInventoryMovement).toHaveBeenCalledWith("tok", "p1", {
        movementType: "return",
        quantity: 4,
        assetId: "asset-1",
        serviceOrderId: "os1",
        notes: "Devolvida"
      })
    );
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Movimentação registrada no histórico.", "ok"));
    expect(await screen.findByRole("heading", { name: "Atualizada" })).toBeInTheDocument();
    await waitFor(() => expect(api.fetchPartsInventory.mock.calls.length).toBe(loads + 1));
  });

  it("notifica falha na movimentação e esconde o formulário sem permissão ou em peças em uso", async () => {
    api.fetchPartInventoryItem.mockResolvedValue({ part: part("p1") });
    api.createPartInventoryMovement.mockRejectedValue(new Error("saldo negativo"));
    const { notify, unmount } = renderPage();
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    fireEvent.click(await screen.findByRole("button", { name: "Registrar movimentação" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("saldo negativo", "danger"));
    unmount();
    renderPage({ permissions: { update: true } });
    fireEvent.click((await screen.findByText("Peça p1")).closest("button"));
    await screen.findByRole("heading", { name: "Peça p1" });
    expect(document.querySelector(".part-movement-form")).not.toBeInTheDocument();
  });

  it("revisa incongruência do tipo 'não localizado' mantendo ou descartando", async () => {
    const missing = discrepant("m", {
      name: "RAM sumida",
      discrepancyStatus: "missing",
      discrepancyDetails: { previous: JSON.stringify({ name: "Kingston", capacityGb: 8, brand: "KS" }), current: null }
    });
    api.fetchPartsInventory.mockResolvedValue({ parts: [missing] });
    api.fetchPartInventoryItem.mockResolvedValue({ part: missing });
    api.reviewPartInventoryDiscrepancy.mockResolvedValue({});
    const { notify, onOpenAsset } = renderPage();
    fireEvent.click((await screen.findByText("RAM sumida")).closest("button"));
    expect(await screen.findByText("Componente não localizado")).toBeInTheDocument();
    expect(screen.getByText("O agente identificou uma mudança de hardware sem movimentação ou OS correspondente.")).toBeInTheDocument();
    expect(screen.getByText("Kingston · KS · 8 GB")).toBeInTheDocument();
    expect(screen.getByText("Não localizado nesta máquina")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Localizar máquina/ }));
    expect(onOpenAsset).toHaveBeenCalledWith("asset-1");
    fireEvent.click(screen.getByRole("button", { name: "Manter pendente" }));
    await waitFor(() => expect(api.reviewPartInventoryDiscrepancy).toHaveBeenCalledWith("tok", "m", "keep"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Incongruência mantida para revisão.", "ok"));
    expect(document.querySelector(".part-inspector")).not.toBeInTheDocument();
  });

  it("trata falha na revisão, snapshot em formatos diversos e ausência de permissão", async () => {
    const changed = discrepant("c", {
      name: "RAM trocada",
      discrepancyDetails: { reason: "Trocada por técnico", previous: ["a", "", "b"], current: "texto livre {" }
    });
    api.fetchPartsInventory.mockResolvedValue({ parts: [changed] });
    api.fetchPartInventoryItem.mockResolvedValue({ part: changed });
    api.reviewPartInventoryDiscrepancy.mockRejectedValue(new Error("sem acesso"));
    const { notify, unmount } = renderPage();
    fireEvent.click((await screen.findByText("RAM trocada")).closest("button"));
    expect(await screen.findByText("Alteração física detectada")).toBeInTheDocument();
    expect(screen.getByText("Trocada por técnico")).toBeInTheDocument();
    expect(screen.getByText("a · b")).toBeInTheDocument();
    expect(screen.getByText("texto livre {")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar incongruência" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("sem acesso", "danger"));
    unmount();
    api.fetchPartInventoryItem.mockResolvedValue({
      part: { ...changed, discrepancyDetails: { previous: [], current: {} }, sourceAssetId: "", assignedAssetId: "" }
    });
    renderPage({ permissions: {} });
    fireEvent.click((await screen.findByText("RAM trocada")).closest("button"));
    await screen.findByText("Alteração física detectada");
    expect(screen.queryByRole("button", { name: "Manter pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Localizar máquina/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Não informado")).toHaveLength(2);
  });

  it("descartar incongruência notifica e fecha o inspetor", async () => {
    const changed = discrepant("c", { name: "RAM trocada" });
    api.fetchPartsInventory.mockResolvedValue({ parts: [changed] });
    api.fetchPartInventoryItem.mockResolvedValue({ part: changed });
    api.reviewPartInventoryDiscrepancy.mockResolvedValue({});
    const { notify } = renderPage();
    fireEvent.click((await screen.findByText("RAM trocada")).closest("button"));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar incongruência" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Incongruência descartada.", "ok"));
  });

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

  describe("kits por computador", () => {
    const inUse = [
      part("k1", { name: "Ryzen", category: "Processador", inventoryState: "in_use", sourceAssetId: "asset-1" }),
      part("k2", { name: "SSD 1", category: "Armazenamento", inventoryState: "in_use", assignedAssetId: "asset-2" })
    ];
    const tabs = [
      { id: "tab-1", name: "Matriz", color: "#111111" },
      { id: "tab-2", name: "", color: "" }
    ];
    const hierarchy = {
      tabs,
      groups: [{ id: "g1", name: "Administrativo", tabId: "tab-1", segmentIds: ["seg-1"] }],
      segments: [{ id: "seg-1", name: "Financeiro", groupId: "g1", tabId: "tab-1", color: "" }]
    };

    it("alterna visões, reinicia filtros e consulta apenas peças em uso", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      renderPage();
      await loaded();
      const views = document.querySelector(".parts-view-tabs");
      expect(within(views).getByRole("button", { name: /Peças por tipo/ })).toHaveClass("active");
      fireEvent.click(within(views).getByRole("button", { name: /Kits por computador/ }));
      await waitFor(() => expect(lastQuery().inventoryState).toBe("in_use"));
      expect(within(views).getByRole("button", { name: /Kits por computador/ })).toHaveClass("active");
      fireEvent.click(within(views).getByRole("button", { name: /Peças por tipo/ }));
      await waitFor(() => expect(lastQuery().inventoryState).toBe(""));
    });

    it("mostra mensagem quando não há kits", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: [part("a")] });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      expect(await screen.findByText("Nenhum kit encontrado")).toBeInTheDocument();
    });

    it("expande kit, abre o ativo e recolhe", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      const { onOpenAsset } = renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      const kit = await screen.findByRole("button", { name: /PC Financeiro/ });
      expect(kit).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(kit);
      expect(kit).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("1 componente(s) físico(s)", { exact: false })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Abrir ativo/ }));
      expect(onOpenAsset).toHaveBeenCalledWith("asset-1");
      fireEvent.click(kit);
      expect(kit).toHaveAttribute("aria-expanded", "false");
    });

    it("organiza por aba/grupo/segmento, troca de aba e mostra vazio do ambiente", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [{ ...inUse[0] }, part("k3", { name: "RAM", category: "Memória", inventoryState: "in_use", sourceAssetId: "asset-3" })]
      });
      renderPage({
        ...hierarchy,
        devices: [
          { id: "asset-1", alias: "PC Financeiro", tabId: "tab-1", segmentId: "seg-1", segmentName: "Financeiro" },
          { id: "asset-3", alias: "PC Outro", tabId: "tab-2", segmentId: "seg-x", segmentName: "Outros" }
        ]
      });
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      const nav = await screen.findByRole("navigation", { name: "Ambientes dos kits" });
      expect(within(nav).getByRole("button", { name: "Matriz" })).toHaveClass("active");
      expect(within(nav).getByRole("button", { name: "Novo ambiente" })).toBeInTheDocument();
      expect(screen.getByText("Administrativo")).toBeInTheDocument();
      expect(screen.getByText("1 máquina(s)")).toBeInTheDocument();
      expect(screen.getByText("1 máquina")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /PC Financeiro/ }));
      fireEvent.click(within(nav).getByRole("button", { name: "Novo ambiente" }));
      expect(within(nav).getByRole("button", { name: "Novo ambiente" })).toHaveClass("active");
      expect(screen.getByRole("button", { name: /PC Outro/ })).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: /PC Financeiro/ })).not.toBeInTheDocument();
    });

    it("peça instalada leva ao kit, seleciona a aba e foca o cartão", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [
          part("k9", { name: "Placa", category: "Placa-mãe", inventoryState: "in_use", assignedAssetId: "asset-1" }),
          part("k8", { name: "Fonte", category: "Fonte", inventoryState: "in_use", assignedAssetId: "asset-9" })
        ]
      });
      renderPage({ ...hierarchy });
      fireEvent.click((await screen.findByText("Placa")).closest("button"));
      const focused = await waitFor(() => {
        const el = document.querySelector(".computer-kit-card.is-focused");
        expect(el).toBeInTheDocument();
        return el;
      });
      expect(focused).toHaveAttribute("tabindex", "-1");
      await waitFor(() => expect(focused).toHaveFocus());
      expect(focused).toHaveClass("is-expanded");
      expect(lastQuery().inventoryState).toBe("in_use");
      expect(screen.getByRole("button", { name: "Matriz" })).toHaveClass("active");
    });

    it("peça com ativo desconhecido abre kit sem trocar de aba; sem ativo abre inspetor", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [part("x", { name: "Órfã", inventoryState: "in_use" })]
      });
      api.fetchPartInventoryItem.mockResolvedValue({ part: part("x", { name: "Órfã", inventoryState: "in_use" }) });
      renderPage({ ...hierarchy });
      fireEvent.click((await screen.findByText("Órfã")).closest("button"));
      expect(await screen.findByRole("heading", { name: "Órfã" })).toBeInTheDocument();
      expect(api.fetchPartInventoryItem).toHaveBeenCalledWith("tok", "x");
    });

    it("corrige a aba ativa quando as abas mudam", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      const { rerender } = renderPage({ ...hierarchy });
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Novo ambiente" }));
      rerender(
        <PartsInventoryPage
          token="tok"
          devices={devices}
          permissions={{}}
          tabs={[{ id: "tab-9", name: "Nova" }]}
          groups={[]}
          segments={[]}
        />
      );
      expect(await screen.findByRole("button", { name: "Nova" })).toHaveClass("active");
      rerender(<PartsInventoryPage token="tok" devices={devices} permissions={{}} tabs={[]} groups={[]} segments={[]} />);
      await waitFor(() => expect(screen.queryByRole("navigation", { name: "Ambientes dos kits" })).not.toBeInTheDocument());
    });
  });
});
