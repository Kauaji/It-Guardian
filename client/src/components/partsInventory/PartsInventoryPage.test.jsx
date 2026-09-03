import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PartsInventoryPage from "./PartsInventoryPage.jsx";

const api = vi.hoisted(() => ({
  fetchPartsInventory: vi.fn(), fetchPartInventoryItem: vi.fn(), createPartInventoryItem: vi.fn(),
  updatePartInventoryItem: vi.fn(), createPartInventoryMovement: vi.fn()
}));
vi.mock("../../api.js", () => api);

describe("PartsInventoryPage", () => {
  beforeEach(() => api.fetchPartsInventory.mockResolvedValue({ parts: [{ id: "p1", name: "SSD NVMe", category: "Armazenamento", quantity: 3, minimumStock: 1, unit: "un", stockStatus: "ok" }] }));
  it("mostra saldo real e busca técnica", async () => {
    render(<PartsInventoryPage token="token" permissions={{ create: true }} />);
    expect(await screen.findByText("SSD NVMe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar peça/)).toBeInTheDocument();
    expect(screen.getByText("Unidades disponíveis")).toBeInTheDocument();
  });
});
