import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import { discrepant, part, renderPage, resetApiMocks } from "./partsTestSupport.jsx";

vi.mock("../../api.js", async () => import("./partsApiMock.js"));

describe("PartsInventoryPage (inspetor)", () => {
  beforeEach(resetApiMocks);

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
});
