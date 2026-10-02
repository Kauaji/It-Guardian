import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultInventoryTab } from "../../components/inventory/inventoryLocalState.js";
import { useInventoryFilters } from "./useInventoryFilters.js";
import { useInventoryModel } from "./useInventoryModel.js";

const tabs = [
  { id: "tab-a", name: "Matriz", order: 0 },
  { id: "tab-b", name: "Filial", order: 1 }
];

const data = {
  allDevices: [
    { id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes" },
    { id: "d2", name: "PC-02", segmentId: "s2", segmentName: "Filial" },
    { id: "d3", name: "Reserva", isBackup: true, backupStatus: "available", segmentId: "s1", segmentName: "Redes" },
    { id: "d4", name: "Solto", segmentId: "def", segmentName: "Não organizadas" }
  ],
  devices: [],
  segmentGroups: [{ id: "g1", name: "Andar 1", segmentIds: ["s1"] }],
  segments: [
    { id: "def", name: "Não organizadas", isDefault: true },
    { id: "s1", name: "Redes", groupId: "g1" },
    { id: "s2", name: "Caixas" }
  ]
};

function persistenceFor(overrides = {}) {
  return {
    activeInventoryTabId: "tab-a",
    inventoryTabMeta: { segments: { s2: { tabId: "tab-b" } }, devices: { d2: { tabId: "tab-b" } }, groups: {} },
    inventoryTabs: tabs,
    machineAliases: {},
    setActiveInventoryTabId: vi.fn(),
    ...overrides
  };
}

describe("useInventoryModel", () => {
  it("separa dispositivos e segmentos por aba, mantendo globais (backup e nao organizados)", () => {
    const persistence = persistenceFor();
    const { result } = renderHook(() => useInventoryModel({ data, persistence }));
    const model = result.current;

    expect(model.activeInventoryTab.id).toBe("tab-a");
    expect(model.activeAllDevices.map((device) => device.id)).toEqual(["d1", "d3", "d4"]);
    expect(model.activeSegments.map((segment) => segment.id)).toEqual(["system-backup", "def", "s1"]);
    expect(model.activeSegmentGroups.map((group) => group.id)).toEqual(["g1"]);
    expect(model.decoratedSegments.find((segment) => segment.id === "s2").tabId).toBe("tab-b");
  });

  it("troca a lista ativa ao mudar de aba", () => {
    const persistence = persistenceFor({ activeInventoryTabId: "tab-b" });
    const { result } = renderHook(() => useInventoryModel({ data, persistence }));
    expect(result.current.activeAllDevices.map((device) => device.id)).toEqual(["d2", "d3", "d4"]);
    expect(result.current.activeSegments.map((segment) => segment.id)).toContain("s2");
  });

  it("corrige a aba ativa quando ela nao existe mais e cai na aba padrao sem abas", () => {
    const persistence = persistenceFor({ activeInventoryTabId: "tab-removida" });
    const { result } = renderHook(() => useInventoryModel({ data, persistence }));
    expect(result.current.activeInventoryTab.id).toBe("tab-a");
    expect(persistence.setActiveInventoryTabId).toHaveBeenCalledWith("tab-a");

    const empty = persistenceFor({ inventoryTabs: [], activeInventoryTabId: "x" });
    const { result: emptyResult } = renderHook(() => useInventoryModel({ data, persistence: empty }));
    expect(emptyResult.current.activeInventoryTab).toBe(defaultInventoryTab);
  });

  it("encontra um dispositivo decorado ou, na falta, o cru", () => {
    const persistence = persistenceFor();
    const { result } = renderHook(() =>
      useInventoryModel({ data: { ...data, devices: [{ id: "extra", name: "So na lista filtrada" }] }, persistence })
    );
    expect(result.current.findDecoratedDevice("d1").displayName).toBe("PC-01");
    expect(result.current.findDecoratedDevice("extra").name).toBe("So na lista filtrada");
    expect(result.current.findDecoratedDevice("nada")).toBeUndefined();
  });
});

describe("useInventoryFilters", () => {
  function setup() {
    const persistence = persistenceFor();
    return renderHook(() => {
      const model = useInventoryModel({ data, persistence });
      const filters = useInventoryFilters({ model, persistence });
      return { filters, model };
    });
  }

  it("sem busca mostra so a aba ativa", () => {
    const { result } = setup();
    expect(result.current.filters.inventorySearchActive).toBe(false);
    expect(result.current.filters.inventoryViewDevices.map((device) => device.id)).toEqual(["d1", "d3", "d4"]);
    expect(result.current.filters.filteredInventoryDevices).toHaveLength(3);
  });

  it("com busca procura em todas as abas e informa a aba do achado", () => {
    const { result } = setup();
    act(() => result.current.filters.setInventorySearch("pc-02"));
    expect(result.current.filters.inventorySearchActive).toBe(true);
    expect(result.current.filters.inventoryViewSegments.some((segment) => segment.id === "s2")).toBe(true);
    expect(result.current.filters.filteredInventoryDevices.map((device) => device.id)).toEqual(["d2"]);
    expect(result.current.filters.filteredInventoryDevices[0].inventorySearchTabName).toBe("Filial");
  });

  it("selecionar grupo zera o segmento e selecionar segmento ajusta o grupo", () => {
    const { result } = setup();
    act(() => result.current.filters.selectInventorySegment("s1"));
    expect(result.current.filters.selectedInventorySegment).toBe("s1");
    expect(result.current.filters.selectedInventoryGroup).toBe("g1");

    act(() => result.current.filters.selectInventorySegment("def"));
    expect(result.current.filters.selectedInventoryGroup).toBe("ungrouped");

    act(() => result.current.filters.selectInventoryGroup("g1"));
    expect(result.current.filters.selectedInventoryGroup).toBe("g1");
    expect(result.current.filters.selectedInventorySegment).toBe("all");

    act(() => result.current.filters.selectInventorySegment("all"));
    expect(result.current.filters.selectedInventoryGroup).toBe("all");
  });

  it("volta para 'todos' quando o segmento ou grupo selecionado deixa de existir", () => {
    const { result } = setup();
    act(() => result.current.filters.setSelectedInventorySegment("fantasma"));
    expect(result.current.filters.selectedInventorySegment).toBe("all");

    act(() => {
      result.current.filters.setSelectedInventoryGroup("g-fantasma");
      result.current.filters.setSelectedInventorySegment("s1");
    });
    expect(result.current.filters.selectedInventoryGroup).toBe("all");
    expect(result.current.filters.selectedInventorySegment).toBe("all");
  });

  it("resetInventoryFilters limpa busca, grupo e segmento", () => {
    const { result } = setup();
    act(() => {
      result.current.filters.setInventorySearch("pc");
      result.current.filters.setSelectedInventoryGroup("g1");
    });
    act(() => result.current.filters.resetInventoryFilters());
    expect(result.current.filters.inventorySearch).toBe("");
    expect(result.current.filters.selectedInventoryGroup).toBe("all");
  });
});
