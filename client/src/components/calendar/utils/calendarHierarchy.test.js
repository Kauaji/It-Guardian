import { describe, expect, it } from "vitest";
import {
  applyHierarchySelection,
  applyInferredHierarchy,
  applyServiceOrderSelection,
  buildEventPayload,
  hierarchyOptions,
  inferHierarchyPatch,
  initialEventForm,
  isFinalizedServiceOrder,
  isMaintenanceSegment,
  normalizedName,
  selectableServiceOrders
} from "./calendarHierarchy.js";

const groups = [{ id: "g1", tabId: "t1" }];
const segments = [
  { id: "s1", name: "Financeiro", groupId: "g1", tabId: "t1" },
  { id: "s2", name: "Manutenção", groupId: "g1", tabId: "t1" }
];
const devices = [{ id: "d1", segmentId: "s1", tabId: "t1" }];

describe("calendarHierarchy", () => {
  it("normaliza nomes sem acento e identifica segmento de manutenção", () => {
    expect(normalizedName("  Manutenção ")).toBe("manutencao");
    expect(normalizedName()).toBe("");
    expect(isMaintenanceSegment({ name: "MANUTENÇÃO" })).toBe(true);
    expect(isMaintenanceSegment(undefined)).toBe(false);
  });

  it("reconhece OS finalizadas por status ou data de fechamento", () => {
    expect(isFinalizedServiceOrder({ status: "Concluída" })).toBe(true);
    expect(isFinalizedServiceOrder({ status: "open", closedAt: "2026-01-01" })).toBe(true);
    expect(isFinalizedServiceOrder({ status: "open" })).toBe(false);
    expect(isFinalizedServiceOrder(null)).toBe(false);
    expect(selectableServiceOrders([{ id: 1, status: "closed" }, { id: 2 }])).toEqual([{ id: 2 }]);
  });

  it("lista opções dependentes do nível escolhido", () => {
    expect(hierarchyOptions({ tabId: "", groupId: "", segmentId: "" }, { groups, segments, devices })).toEqual({
      groupsForTab: [],
      segmentsForGroup: [],
      devicesForSegment: []
    });
    const options = hierarchyOptions({ tabId: "t1", groupId: "g1", segmentId: "s1" }, { groups, segments, devices });
    expect(options.groupsForTab).toEqual(groups);
    expect(options.segmentsForGroup.map((item) => item.id)).toEqual(["s1"]);
    expect(options.devicesForSegment).toEqual(devices);
    expect(hierarchyOptions({ tabId: "", groupId: "g1" }, { groups, segments, devices }).segmentsForGroup).toHaveLength(1);
  });

  it("deduz a aba e os pais somente quando falta a aba", () => {
    const form = { assetId: "d1", groupId: "", segmentId: "", tabId: "" };
    expect(inferHierarchyPatch(form, { devices, segments, groups })).toEqual({ tabId: "t1", groupId: "g1", segmentId: "s1" });
    expect(inferHierarchyPatch({ ...form, tabId: "t1" }, { devices, segments, groups })).toBeNull();
    expect(inferHierarchyPatch({ ...form, assetId: "x" }, { devices, segments, groups })).toBeNull();
    expect(applyInferredHierarchy({ groupId: "gx", segmentId: "", title: "a" }, { tabId: "t1", groupId: "g1", segmentId: "s1" })).toEqual({
      groupId: "gx",
      segmentId: "s1",
      title: "a",
      tabId: "t1"
    });
  });

  it("limpa os níveis inferiores ao trocar a seleção", () => {
    const current = { tabId: "t", groupId: "g", segmentId: "s", assetId: "a", other: 1 };
    expect(applyHierarchySelection(current, "tabId", "t2")).toEqual({ tabId: "t2", groupId: "", segmentId: "", assetId: "", other: 1 });
    expect(applyHierarchySelection(current, "groupId", "g2")).toEqual({ tabId: "t", groupId: "g2", segmentId: "", assetId: "", other: 1 });
    expect(applyHierarchySelection(current, "segmentId", "s2")).toEqual({
      tabId: "t",
      groupId: "g",
      segmentId: "s2",
      assetId: "",
      other: 1
    });
    expect(applyHierarchySelection(current, "assetId", "a2")).toEqual({ ...current, assetId: "a2" });
  });

  it("vincula a OS preenchendo a hierarquia do ativo", () => {
    const orders = [{ id: "os1", assetId: "d1" }, { id: "os2" }];
    const current = { serviceOrderId: "", assetId: "keep", segmentId: "keep-s", groupId: "keep-g", tabId: "keep-t" };
    expect(applyServiceOrderSelection(current, "os1", { orders, devices, segments, groups })).toEqual({
      serviceOrderId: "os1",
      assetId: "d1",
      segmentId: "s1",
      groupId: "g1",
      tabId: "t1"
    });
    expect(applyServiceOrderSelection(current, "os2", { orders, devices, segments, groups })).toEqual({
      ...current,
      serviceOrderId: "os2"
    });
  });

  it("monta o formulário inicial e o payload sem a aba", () => {
    const form = initialEventForm(undefined, new Date(2026, 8, 3, 15), { title: "T" });
    expect(form).toMatchObject({ title: "T", startAt: "2026-09-03T09:00", endAt: "2026-09-03T10:00", tabId: "", allDay: false });
    const payload = buildEventPayload({ ...form, endAt: "" });
    expect(payload).not.toHaveProperty("tabId");
    expect(payload).toMatchObject({ environmentName: null, endAt: null });
    expect(payload.startAt).toBe(new Date("2026-09-03T09:00").toISOString());
  });
});
