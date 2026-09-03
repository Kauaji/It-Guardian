import { render, screen } from "@testing-library/react";
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
    api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p1", name: "SSD NVMe", category: "Armazenamento", inventoryState: "available", discrepancyStatus: "ok", quantity: 3, minimumStock: 1, unit: "un", stockStatus: "ok" }] });
    api.fetchPartCategories.mockResolvedValue({ categories: [{ id: "c1", name: "Armazenamento", color: "#2563eb" }] });
  });
  it("mostra saldo real e busca técnica", async () => {
    render(<PartsInventoryPage token="token" permissions={{ create: true }} />);
    expect(await screen.findByText("SSD NVMe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar peça/)).toBeInTheDocument();
    expect(screen.getByText("Unidades disponíveis")).toBeInTheDocument();
  });
});
