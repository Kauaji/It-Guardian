import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PartsInventoryPage from "./PartsInventoryPage.jsx";

const api = vi.hoisted(() => ({
  fetchPartsInventory: vi.fn(), fetchPartInventoryItem: vi.fn(), createPartInventoryItem: vi.fn(),
  updatePartInventoryItem: vi.fn(), createPartInventoryMovement: vi.fn(), fetchPartCategories: vi.fn(),
  createPartCategory: vi.fn(), deletePartCategory: vi.fn(), syncPartsFromAssets: vi.fn(), importPartsInvoice: vi.fn()
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
    expect(await screen.findByText("PC Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Processadores")).toBeInTheDocument();
  });
});
