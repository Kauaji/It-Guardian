import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PartsInventoryPage from "./PartsInventoryPage.jsx";

const api = vi.hoisted(() => ({
  fetchPartsInventory: vi.fn(), fetchPartInventoryItem: vi.fn(), createPartInventoryItem: vi.fn(),
  updatePartInventoryItem: vi.fn(), createPartInventoryMovement: vi.fn(), fetchPartCategories: vi.fn(),
  createPartCategory: vi.fn(), deletePartCategory: vi.fn(), syncPartsFromAssets: vi.fn(), importPartsInvoice: vi.fn(),
  reviewPartInventoryDiscrepancy: vi.fn()
}));
vi.mock("../../api.js", () => api);

describe("PartsInventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p1", name: "SSD NVMe", category: "Armazenamento", inventoryState: "available", discrepancyStatus: "ok", quantity: 3, minimumStock: 1, unit: "un", stockStatus: "ok" }] });
    api.fetchPartCategories.mockResolvedValue({ categories: [{ id: "c1", name: "Armazenamento", color: "#2563eb" }] });
    api.syncPartsFromAssets.mockResolvedValue({ summary: { created: 0, discrepancies: 0 } });
  });
  it("mostra saldo real e busca técnica", async () => {
    render(<PartsInventoryPage token="token" permissions={{ create: true }} />);
    expect(await screen.findByText("SSD NVMe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar peça/)).toBeInTheDocument();
    expect(screen.getByText("Unidades disponíveis")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HD, SSD e NVMe" })).toBeInTheDocument();
  });

  it("concilia automaticamente ao carregar e não mostra o botão manual", async () => {
    render(<PartsInventoryPage token="token" permissions={{ reconcileHardware: true }} />);
    await waitFor(() => expect(api.syncPartsFromAssets).toHaveBeenCalledWith("token"));
    expect(screen.queryByRole("button", { name: /conciliar ativos/i })).not.toBeInTheDocument();
  });

  it("organiza componentes instalados em kits por computador", async () => {
    api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p2", name: "Ryzen 5", category: "Processador", inventoryState: "in_use", sourceAssetId: "asset-1", discrepancyStatus: "ok", quantity: 1, unit: "un", stockStatus: "ok" }] });
    render(<PartsInventoryPage token="token" devices={[{ id: "asset-1", alias: "PC Financeiro", segmentName: "Financeiro" }]} permissions={{}} />);
    fireEvent.click(await screen.findByRole("button", { name: /kits por computador/i }));
    const kit = await screen.findByRole("button", { name: /PC Financeiro/i });
    expect(screen.queryByText("Processadores")).not.toBeInTheDocument();
    fireEvent.click(kit);
    expect(screen.getByText("Processadores")).toBeInTheDocument();
  });

  it("leva uma peça instalada diretamente ao kit da máquina", async () => {
    api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p3", name: "B550M Pro", category: "Placa-mãe", inventoryState: "in_use", assignedAssetId: "asset-2", discrepancyStatus: "ok", quantity: 1, unit: "un", stockStatus: "ok" }] });
    render(<PartsInventoryPage token="token" devices={[{ id: "asset-2", alias: "PC Projetos", segmentName: "Engenharia" }]} permissions={{}} />);
    fireEvent.click((await screen.findByText("B550M Pro")).closest("button"));
    expect(await screen.findByText("PC Projetos")).toBeInTheDocument();
    expect(document.querySelector(".computer-kit-card.is-focused")).toBeInTheDocument();
    expect(api.fetchPartInventoryItem).not.toHaveBeenCalled();
  });

  it("replica abas, grupos e segmentos do inventário nos kits", async () => {
    api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p4", name: "8 GB", category: "Memória", inventoryState: "in_use", sourceAssetId: "asset-4", discrepancyStatus: "ok", quantity: 1, unit: "un", stockStatus: "ok", metadata: { hardwareType: "memory", collectedValue: { capacityGb: 8 } } }] });
    render(<PartsInventoryPage token="token" devices={[{ id: "asset-4", alias: "Notebook Fiscal", tabId: "tab-1", segmentId: "seg-1", segmentName: "Fiscal" }]} tabs={[{ id: "tab-1", name: "Matriz", color: "#2563eb" }]} groups={[{ id: "group-1", name: "Administrativo", tabId: "tab-1", segmentIds: ["seg-1"] }]} segments={[{ id: "seg-1", name: "Fiscal", groupId: "group-1", tabId: "tab-1" }]} permissions={{}} />);
    fireEvent.click(await screen.findByRole("button", { name: /kits por computador/i }));
    expect(await screen.findByRole("button", { name: "Matriz" })).toBeInTheDocument();
    expect(screen.getByText("Administrativo")).toBeInTheDocument();
    expect(screen.getByText("Fiscal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Notebook Fiscal/i }));
    expect(screen.getByText("8 GB (8 GB)")).toBeInTheDocument();
  });

  it("abre a revisão detalhada e descarta somente incongruência de hardware", async () => {
    const part = { id: "p5", name: "16 GB", category: "Memória", inventoryState: "in_use", sourceAssetId: "asset-5", discrepancyStatus: "unverified_change", discrepancyDetails: { reason: "Memória alterada", previous: { capacityGb: 8 }, current: { capacityGb: 16 } }, metadata: { hardwareType: "memory" }, quantity: 1, unit: "un", stockStatus: "ok" };
    api.fetchPartsInventory.mockResolvedValue({ parts: [part] });
    api.fetchPartInventoryItem.mockResolvedValue({ part });
    api.reviewPartInventoryDiscrepancy.mockResolvedValue({ part: { ...part, discrepancyStatus: "ok" } });
    render(<PartsInventoryPage token="token" devices={[{ id: "asset-5", alias: "PC Estoque" }]} permissions={{ reconcileHardware: true }} />);
    fireEvent.click((await screen.findByText("16 GB")).closest("button"));
    expect(await screen.findByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("8 GB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar incongruência" }));
    await waitFor(() => expect(api.reviewPartInventoryDiscrepancy).toHaveBeenCalledWith("token", "p5", "dismiss"));
  });
});
