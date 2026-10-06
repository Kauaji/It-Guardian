import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import ServiceOrderDetailsModal from "./ServiceOrderDetailsModal.jsx";
import { makeDetailsProps, makeDevice, makeOrder, wireApi } from "./test/fixtures.jsx";

vi.mock("../../api.js", async () => (await import("./test/fixtures.jsx")).createApiMock());
vi.mock("../remoteAssistance/RemoteAssistanceAction.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("remote"));
vi.mock("./tabs/ServiceOrderSlaTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-sla"));
vi.mock("./tabs/ServiceOrderAgendaTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-agenda"));
vi.mock("./tabs/ServiceOrderChecklistTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-checklist"));
vi.mock("./tabs/ServiceOrderScriptsTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-scripts"));
vi.mock("./tabs/ServiceOrderAttachmentsTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-attachments"));
vi.mock("./tabs/ServiceOrderFeedbackTab.jsx", async () => (await import("./test/fixtures.jsx")).stubModule("tab-feedback"));

const click = (element) => fireEvent.click(element);
const tab = (name) => screen.getByRole("button", { name, selector: ".machine-tabs button" });
const form = () => document.querySelector(".service-order-attendance-form");
const field = (label) => within(form()).getByLabelText(label);

async function renderDetails(overrides) {
  const props = makeDetailsProps(overrides);
  const view = render(<ServiceOrderDetailsModal {...props} />);
  await act(async () => {});
  return { ...view, props };
}

async function openAttendance(overrides) {
  const result = await renderDetails(overrides);
  click(tab("Atendimento"));
  return result;
}

describe("ServiceOrderDetailsModal - atendimento", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset?.());
    wireApi(api);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mostra os campos do rascunho a partir da OS e salva o payload no modo Local", async () => {
    const { props } = await openAttendance({
      serviceOrder: makeOrder({ diagnosis: "Fonte", attendanceNotes: "Notas", autoPriorityEnabled: true, serviceValue: 99, items: [{ id: "i1", productName: "Fonte", quantity: 2, unitPrice: 10 }] })
    });
    expect(field("Título")).toHaveValue("Computador não liga");
    expect(field("Prioridade")).toHaveValue("high");
    expect(field("Diagnóstico")).toHaveValue("Fonte");
    expect(screen.getByText("Automática")).toBeInTheDocument();
    expect(within(form()).getByRole("combobox", { name: /Técnico responsável/ })).toHaveValue("Ana Técnica");
    fireEvent.change(field("Título"), { target: { value: "Novo título" } });
    fireEvent.change(field("Prioridade"), { target: { value: "low" } });
    fireEvent.change(field("Observações do atendimento"), { target: { value: "Mais notas" } });
    fireEvent.change(field("Diagnóstico"), { target: { value: "Outro" } });
    fireEvent.change(within(form()).getByRole("combobox", { name: /Técnico responsável/ }), { target: { value: "Bruno Silva" } });
    click(within(form()).getByRole("checkbox"));
    expect(screen.getByText("Manual")).toBeInTheDocument();
    fireEvent.submit(form());
    expect(props.onUpdate).toHaveBeenCalledWith("os-1", expect.objectContaining({
      title: "Novo título", priority: "low", attendanceNotes: "Mais notas", diagnosis: "Outro", assignedTechnicianName: "Bruno Silva",
      autoPriorityEnabled: false, serviceValue: 0, totalPartsValue: 0, totalValue: 0,
      items: [expect.objectContaining({ id: "i1", productName: "Fonte", quantity: 2, unitPrice: 10, subtotal: 20 })]
    }));
    expect(form().querySelector(".service-order-financial-panel")).toBeNull();
  });

  it("avisa quando não há técnicos e controla o botão salvar", async () => {
    api.fetchTechnicians.mockResolvedValue({ technicians: [] });
    const { unmount } = await openAttendance({ saving: true });
    expect(screen.getByText("Não existem técnicos cadastrados. Cadastre técnicos nas Configurações da OS.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    unmount();
    await openAttendance({ permissions: { attendance: false } });
    expect(screen.getByRole("button", { name: "Salvar atendimento" })).toBeDisabled();
  });

  describe("serviços realizados", () => {
    const openServices = () => click(within(form()).getByRole("button", { name: /Serviços realizados/ }));
    const input = () => within(form()).getByPlaceholderText("Digite para buscar um serviço");

    it("sugere serviços, escolhe um e aplica o valor padrão no modo Business", async () => {
      const { props } = await openAttendance({ systemMode: "business" });
      expect(within(form()).getByRole("button", { name: /Serviços realizados/ })).toHaveAttribute("aria-expanded", "false");
      openServices();
      expect(within(form()).getByRole("button", { name: "Adicionar serviço" })).toBeDisabled();
      fireEvent.focus(input());
      const listbox = within(form()).getByRole("listbox");
      expect(within(listbox).getAllByRole("button")).toHaveLength(2);
      fireEvent.change(input(), { target: { value: "format" } });
      click(within(within(form()).getByRole("listbox")).getByRole("button", { name: /Formatação/ }));
      expect(input()).toHaveValue("Formatação");
      expect(within(form()).queryByRole("listbox")).toBeNull();
      expect(within(form()).getByLabelText("Valor do serviço")).toHaveValue("150");
      fireEvent.change(within(form()).getByLabelText("Valor do serviço"), { target: { value: "R$ 1.234,50" } });
      fireEvent.blur(within(form()).getByLabelText("Valor do serviço"));
      expect(within(form()).getByLabelText("Valor do serviço")).toHaveValue("1234.5");
      expect(form().querySelector(".service-order-totals")).toHaveTextContent("Total estimado R$ 1.234,50");
      fireEvent.submit(form());
      expect(props.onUpdate).toHaveBeenCalledWith("os-1", expect.objectContaining({ servicePerformed: "Formatação", serviceValue: 1234.5, totalValue: 1234.5 }));
    });

    it("no modo Local zera o valor e aceita serviço digitado manualmente", async () => {
      const { props } = await openAttendance();
      openServices();
      fireEvent.change(input(), { target: { value: "Serviço novo" } });
      const listbox = within(form()).getByRole("listbox");
      click(within(listbox).getByRole("button", { name: /Usar "Serviço novo"/ }));
      expect(within(form()).queryByRole("listbox")).toBeNull();
      fireEvent.change(input(), { target: { value: "Troca de peça" } });
      click(within(form()).getByRole("button", { name: "Adicionar serviço" }));
      expect(input()).toHaveValue("Troca de peça");
      fireEvent.change(input(), { target: { value: "" } });
      expect(within(form()).getByRole("button", { name: "Adicionar serviço" })).toBeDisabled();
      fireEvent.change(input(), { target: { value: "  manual  " } });
      click(within(form()).getByRole("button", { name: "Adicionar serviço" }));
      fireEvent.submit(form());
      expect(props.onUpdate).toHaveBeenCalledWith("os-1", expect.objectContaining({ servicePerformed: "manual", serviceValue: 0 }));
      expect(within(form()).queryByLabelText("Valor do serviço")).toBeNull();
    });

    it("fecha as sugestões ao sair do campo e avisa quando não há serviços", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      try {
        api.fetchServices.mockResolvedValue({ services: [] });
        await openAttendance();
        openServices();
        expect(within(form()).getByText("Nenhum serviço cadastrado. Cadastre serviços nas Configurações da OS.")).toBeInTheDocument();
        fireEvent.change(input(), { target: { value: "x" } });
        expect(within(form()).getByRole("listbox")).toBeInTheDocument();
        fireEvent.blur(input());
        act(() => vi.advanceTimersByTime(130));
        expect(within(form()).queryByRole("listbox")).toBeNull();
        click(within(form()).getByRole("button", { name: /Serviços realizados/ }));
        expect(within(form()).queryByPlaceholderText("Digite para buscar um serviço")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("peças trocadas", () => {
    const openParts = () => click(within(form()).getByRole("button", { name: /Peças trocadas/ }));
    const input = () => within(form()).getByPlaceholderText("Digite para buscar uma peça");

    it("adiciona peça do catálogo com valor, soma e remove", async () => {
      const { props } = await openAttendance({ systemMode: "business" });
      openParts();
      fireEvent.focus(input());
      expect(within(within(form()).getByRole("listbox")).getAllByRole("button")).toHaveLength(3);
      fireEvent.change(input(), { target: { value: "mem" } });
      click(within(within(form()).getByRole("listbox")).getByRole("button", { name: /Memória DDR4/ }));
      expect(input()).toHaveValue("Memória DDR4");
      expect(within(form()).getByLabelText("Categoria")).toHaveValue("Memória");
      expect(within(form()).getByLabelText("Marca")).toHaveValue("Kingston");
      expect(within(form()).getByLabelText("Valor unitário")).toHaveValue("250.5");
      fireEvent.change(within(form()).getByLabelText("Quantidade"), { target: { value: "2" } });
      click(within(form()).getByRole("button", { name: "Adicionar peça" }));
      expect(input()).toHaveValue("");
      expect(within(form()).getByLabelText("Categoria")).toHaveValue("Não informado");
      const items = form().querySelector(".service-order-items-list");
      expect(items).toHaveTextContent("Memória DDR4");
      expect(items).toHaveTextContent("2 x R$ 250,50");
      expect(form().querySelector(".service-order-totals")).toHaveTextContent("Total de peças R$ 501,00");

      fireEvent.change(input(), { target: { value: "Peça avulsa" } });
      click(within(within(form()).getByRole("listbox")).getByRole("button", { name: /Usar "Peça avulsa"/ }));
      expect(items.textContent).toContain("Peça avulsa");
      fireEvent.submit(form());
      const payload = props.onUpdate.mock.calls[0][1];
      expect(payload.partsUsed).toBe("Memória DDR4 x2 - R$\u00a0501,00\nPeça avulsa x1");
      expect(payload.totalPartsValue).toBe(501);
      expect(payload.items.map((item) => item.productName)).toEqual(["Memória DDR4", "Peça avulsa"]);

      click(within(form()).getAllByTitle("Remover peça")[0]);
      expect(form().querySelector(".service-order-items-list")).not.toHaveTextContent("Memória DDR4");
    });

    it("reconhece produto pelo nome digitado e mostra vazio sem peças com valor", async () => {
      const { props } = await openAttendance({ systemMode: "business" });
      openParts();
      expect(form().querySelector(".service-order-financial-panel")).toBeNull();
      fireEvent.change(input(), { target: { value: "ssd 480" } });
      fireEvent.change(within(form()).getByLabelText("Valor unitário"), { target: { value: "0" } });
      click(within(form()).getByRole("button", { name: "Adicionar peça" }));
      expect(form().querySelector(".service-order-items-list")).toHaveTextContent("SSD 480");
      expect(form().querySelector(".service-order-items-list")).toHaveTextContent("1 x R$ 0,00");
      fireEvent.submit(form());
      expect(props.onUpdate.mock.calls[0][1].partsUsed).toBe("SSD 480 x1");
    });

    it("não adiciona sem produto, mostra aviso sem catálogo e esconde campos de valor no modo Local", async () => {
      api.fetchProducts.mockResolvedValue({ products: [] });
      await openAttendance();
      openParts();
      expect(within(form()).getByRole("button", { name: "Adicionar peça" })).toBeDisabled();
      expect(within(form()).queryByLabelText("Valor unitário")).toBeNull();
      expect(within(form()).getByText("Nenhuma peça cadastrada. Cadastre peças nas Configurações da OS.")).toBeInTheDocument();
      fireEvent.change(input(), { target: { value: "avulsa" } });
      expect(within(form()).getByRole("button", { name: "Adicionar peça" })).not.toBeDisabled();
      click(within(form()).getByRole("button", { name: "Adicionar peça" }));
      click(within(form()).getByRole("button", { name: /Peças trocadas/ }));
      expect(within(form()).queryByPlaceholderText("Digite para buscar uma peça")).toBeNull();
    });

    it("mostra painel financeiro com valor de serviço mesmo sem peças", async () => {
      await openAttendance({ systemMode: "business", serviceOrder: makeOrder({ serviceValue: 40 }) });
      const panel = form().querySelector(".service-order-financial-panel");
      expect(panel).toHaveTextContent("Nenhuma peça com valor adicionada.");
      expect(panel).toHaveTextContent("Serviço R$ 40,00");
      expect(document.querySelector(".service-order-print-financial")).toHaveTextContent("R$ 40,00");
    });
  });
});

describe("ServiceOrderDetailsModal - máquina", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset?.());
    wireApi(api);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const backups = [
    makeDevice({ id: "bk-1", name: "BK-01", isBackup: true, ip: "", statusLabel: "" }),
    makeDevice({ id: "bk-2", name: "BK-02", isBackup: true, backupStatus: "in_use" })
  ];

  it("mostra a ficha da máquina e lista backups disponíveis", async () => {
    api.fetchDevice.mockResolvedValue({ device: makeDevice({ hardware: { os: "Windows 11", lastInventoryAt: "2026-08-01T10:00:00.000Z" }, metrics: { cpu: 10, ram: 0 }, alias: "Fin" }) });
    const { props } = await renderDetails({ devices: [makeDevice(), ...backups] });
    click(tab("Máquina"));
    const panel = document.querySelector(".service-order-asset-panel");
    expect(api.fetchDevice).toHaveBeenCalledWith("tok", "dev-1");
    const item = (label) => within(panel).getByText(label).closest(".service-order-detail-item");
    expect(item("Nome fantasia")).toHaveTextContent("Fin");
    expect(item("Sistema operacional")).toHaveTextContent("Windows 11");
    expect(item("CPU")).toHaveTextContent("10%");
    expect(item("RAM")).toHaveTextContent("0%");
    expect(item("Disco")).toHaveTextContent("Não disponível");
    expect(item("Tipo")).toHaveTextContent("Desktop");
    const cards = panel.querySelectorAll(".service-order-backup-card-list button");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("BK-01");
    expect(cards[0]).toHaveTextContent("Sem IP");
    expect(cards[0]).toHaveTextContent("Sem status");
    click(cards[0]);
    expect(props.onSelectBackup).toHaveBeenCalledWith(props.serviceOrder, backups[0]);
  });

  it("devolve o backup vinculado e informa quando não há disponíveis", async () => {
    const { props, unmount } = await renderDetails({ serviceOrder: makeOrder({ backupAssetId: "bk-1" }), devices: [makeDevice(), ...backups] });
    click(tab("Máquina"));
    const linked = document.querySelector(".service-order-linked-backup");
    expect(linked).toHaveTextContent("BK-01");
    click(within(linked).getByRole("button", { name: /Devolver Backup/ }));
    expect(props.onReleaseBackup).toHaveBeenCalledWith(props.serviceOrder);
    unmount();
    await renderDetails({ devices: [makeDevice()] });
    click(tab("Máquina"));
    expect(screen.getByText("Nenhuma máquina Backup disponível no momento.")).toBeInTheDocument();
  });

  it("sem máquina vinculada orienta e abre o assistente de vínculo", async () => {
    const { props } = await renderDetails({
      serviceOrder: makeOrder({ assetId: "" }),
      devices: [makeDevice(), makeDevice({ id: "dev-2", name: "PC-02", ip: "", statusLabel: "", segmentId: "seg-1", tabId: "tab-1", groupId: "g1" }), makeDevice({ id: "dev-3", name: "PC-03", segmentId: "seg-2", tabId: "tab-1", isGlobalUnorganized: true }), makeDevice({ id: "dev-4", name: "PC-04", segmentId: "seg-4", tabId: "tab-2", segmentGroupId: "g2" })]
    });
    click(tab("Máquina"));
    expect(screen.getByText("Nenhuma máquina ou ativo vinculado a esta OS.")).toBeInTheDocument();
    expect(screen.getByText("Vincule a máquina principal antes de selecionar um Backup.")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Vincular máquina" }));
    const wizard = document.querySelector(".service-order-link-wizard");
    const select = (label) => within(wizard).getByText(label).closest("label").querySelector("select");
    expect(select("2. Grupo")).toBeDisabled();
    expect(within(wizard).getByText("Escolha uma aba, grupo e segmento para listar máquinas.")).toBeInTheDocument();
    expect([...select("1. Aba/Ambiente").options].map((option) => option.textContent)).toEqual(["Selecione", "Matriz", "Novo ambiente"]);

    fireEvent.change(select("1. Aba/Ambiente"), { target: { value: "tab-1" } });
    expect([...select("2. Grupo").options].map((option) => option.textContent)).toEqual(["Todos os grupos", "Andar 1", "Sem grupo"]);
    expect([...select("3. Segmento").options].map((option) => option.textContent)).toEqual(["Selecione", "Financeiro", "Recepção"]);
    fireEvent.change(select("2. Grupo"), { target: { value: "g1" } });
    expect([...select("3. Segmento").options].map((option) => option.textContent)).toEqual(["Selecione", "Financeiro"]);
    fireEvent.change(select("3. Segmento"), { target: { value: "seg-1" } });
    const cards = () => [...wizard.querySelectorAll(".service-order-link-cards button")].map((button) => button.textContent);
    expect(cards()).toEqual(["PC-FIN-0110.0.0.10 - Online", "PC-02Sem IP - Sem status"]);
    const search = within(wizard).getByPlaceholderText("Buscar máquina no segmento");
    fireEvent.change(search, { target: { value: "pc-02" } });
    expect(cards()).toHaveLength(1);
    fireEvent.change(select("2. Grupo"), { target: { value: "ungrouped" } });
    expect(cards()).toEqual([]);
    fireEvent.change(select("2. Grupo"), { target: { value: "" } });
    fireEvent.change(select("3. Segmento"), { target: { value: "" } });
    expect(search).toBeDisabled();
    fireEvent.change(select("1. Aba/Ambiente"), { target: { value: "tab-2" } });
    expect([...select("2. Grupo").options].map((option) => option.textContent)).toEqual(["Todos os grupos", "Filial"]);
    fireEvent.change(select("3. Segmento"), { target: { value: "seg-4" } });
    expect(cards()).toEqual(["PC-0410.0.0.10 - Online"]);
    click(wizard.querySelector(".service-order-link-cards button"));
    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith("os-1", { assetId: "dev-4", environmentId: "tab-2", environmentName: "Acme" }));
    await waitFor(() => expect(document.querySelector(".service-order-link-wizard")).toBeNull());
  });

  it("vincula usando a aba escolhida quando o ativo não tem aba conhecida", async () => {
    const { props } = await renderDetails({ serviceOrder: makeOrder({ assetId: "", environmentId: "env", environmentName: "Env" }), devices: [makeDevice({ id: "d9", name: "PC-09", tabId: "tab-x", isGlobalUnorganized: true, segmentId: "seg-1" })] });
    click(tab("Máquina"));
    click(screen.getByRole("button", { name: "Vincular máquina" }));
    const wizard = document.querySelector(".service-order-link-wizard");
    fireEvent.change(within(wizard).getByText("1. Aba/Ambiente").closest("label").querySelector("select"), { target: { value: "tab-1" } });
    fireEvent.change(within(wizard).getByText("3. Segmento").closest("label").querySelector("select"), { target: { value: "seg-1" } });
    click(wizard.querySelector(".service-order-link-cards button"));
    await waitFor(() => expect(props.onUpdate).toHaveBeenCalledWith("os-1", { assetId: "d9", environmentId: "tab-1", environmentName: "Matriz" }));
    click(screen.getByRole("button", { name: "Vincular máquina" }));
    fireEvent.click(screen.getByRole("button", { name: "Vincular máquina" }));
  });

  it("ignora falha ao carregar o ativo e usa o da lista", async () => {
    api.fetchDevice.mockRejectedValue(new Error("x"));
    await renderDetails({ devices: [makeDevice({ name: "Lista" })] });
    click(tab("Máquina"));
    expect(document.querySelector(".service-order-asset-panel")).toHaveTextContent("Lista");
  });
});
