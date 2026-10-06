import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import * as api from "../../../api.js";
import InventoryVisualMapView from "../InventoryVisualMapView.jsx";

// Fixtures e utilitarios compartilhados pelos testes do mapa visual. Os vi.mock
// (api e cena) ficam em cada arquivo de teste.
export { api };
export const maps = [{ id: "m1", name: "Térreo", objectCount: 2 }, { id: "m2", name: "Andar 2" }];
export const objects = [
  { id: "o1", layer: "assets", label: "Desktop A", linkedAssetId: "d1", positionX: 1, positionY: 0, positionZ: 2 },
  { id: "o2", layer: "infrastructure", label: "Rack 1", metadata: { circuit: "C1" } }
];
export const connections = [{ id: "c1", layer: "infrastructure", label: "Cabo 1", points: [{ x: 0, y: 0.08, z: 0 }, { x: 2, y: 0.08, z: 2 }] }];
export const devices = [
  { id: "d1", name: "PC-01", status: "online", ip: "10.0.0.1", os: "Win", segmentName: "S1" },
  { id: "d2", hostname: "srv", assetType: "Servidor" }
];
export const tabs = [{ id: "t1", name: "Aba 1" }];
export let notify;

export function renderView(overrides = {}) {
  notify = vi.fn();
  const props = { token: "tok", notify, devices, segments: [{ id: "s1", name: "S1" }], groups: [{ id: "g1", name: "G1" }], tabs, activeTab: tabs[0], canManage: true, ...overrides };
  return { user: userEvent.setup(), ...render(<InventoryVisualMapView {...props} />) };
}

export const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
export const mapNameInput = () => within(screen.getByText("Dados do mapa").closest("section")).getByRole("textbox", { name: "Nome" });
export const sceneState = () => JSON.parse(screen.getByTestId("scene-state").textContent);

export async function openEditing(overrides) {
  const view = renderView(overrides);
  await screen.findByText("sel-o1");
  await settle();
  await view.user.click(screen.getByRole("button", { name: "Editar" }));
  return view;
}


export function armApi() {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);

  let seq = 0;
  api.fetchInventoryVisualMaps.mockResolvedValue({ maps });
  api.fetchInventoryVisualMap.mockImplementation(async (_token, id) => ({
    map: { id, name: id === "m1" ? "Térreo" : "Andar 2", width: 30, depth: 20, scale: 1 },
    objects: id === "m1" ? objects : [],
    connections: id === "m1" ? connections : []
  }));
  api.createInventoryVisualMap.mockResolvedValue({ map: { id: "m2" } });
  api.updateInventoryVisualMap.mockImplementation(async (_token, id, payload) => ({ map: { id, ...payload } }));
  api.deleteInventoryVisualMap.mockResolvedValue({});
  api.createInventoryVisualMapObject.mockImplementation(async (_token, _map, payload) => ({ object: { id: `n${++seq}`, layer: "assets", ...payload } }));
  api.updateInventoryVisualMapObject.mockImplementation(async (_token, id, payload) => ({ object: { id, layer: "assets", ...payload } }));
  api.deleteInventoryVisualMapObject.mockResolvedValue({});
  api.createInventoryVisualMapConnection.mockImplementation(async (_token, _map, payload) => ({ connection: { id: `nc${++seq}`, ...payload } }));
  api.updateInventoryVisualMapConnection.mockImplementation(async (_token, id, payload) => ({ connection: { id, ...payload } }));
  api.deleteInventoryVisualMapConnection.mockResolvedValue({});
}
