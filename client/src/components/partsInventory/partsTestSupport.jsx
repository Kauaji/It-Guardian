import { render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import * as api from "../../api.js";
import PartsInventoryPage from "./PartsInventoryPage.jsx";

export const part = (id, extra = {}) => ({
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
export const discrepant = (id, extra = {}) =>
  part(id, {
    inventoryState: "in_use",
    sourceAssetId: "asset-1",
    discrepancyStatus: "unverified_change",
    metadata: { hardwareType: "memory" },
    ...extra
  });
export const devices = [
  { id: "asset-1", alias: "PC Financeiro", hostname: "fin", tabId: "tab-1", segmentName: "Financeiro" },
  { id: "asset-2", hostname: "host-2" }
];
export const allPermissions = {
  create: true,
  update: true,
  moveStock: true,
  importInvoice: true,
  manageCategories: true,
  reconcileHardware: true
};

export function renderPage(props = {}) {
  const notify = vi.fn();
  const onOpenAsset = vi.fn();
  const utils = render(
    <PartsInventoryPage token="tok" notify={notify} devices={devices} permissions={allPermissions} onOpenAsset={onOpenAsset} {...props} />
  );
  return { notify, onOpenAsset, ...utils };
}
export const loaded = () => waitFor(() => expect(screen.queryByText("Atualizando o inventário...")).not.toBeInTheDocument());
export const lastQuery = () => api.fetchPartsInventory.mock.calls.at(-1)[1];

export function resetApiMocks() {
  vi.clearAllMocks();
  api.fetchPartsInventory.mockResolvedValue({ parts: [part("p1")] });
  api.fetchPartCategories.mockResolvedValue({
    categories: [
      { id: "c1", name: "Armazenamento", color: "#2563eb" },
      { id: "c2", name: "Memória", color: "#0891b2" }
    ]
  });
  api.syncPartsFromAssets.mockResolvedValue({ summary: { created: 0, discrepancies: 0 } });
}
