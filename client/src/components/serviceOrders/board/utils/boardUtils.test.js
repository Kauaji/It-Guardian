import { describe, expect, it } from "vitest";
import { getDropDenial } from "./dropRules.js";
import { filterByCatalog, filterBySearch, filterBySector, getTechnicianNames, isOrderMine } from "./orderFilters.js";
import {
  appendStatus,
  assignStatusRole,
  getRoleReplaceMessage,
  getStatusDeletionBlock,
  hasAnotherWithRole,
  moveStatusBy,
  patchStatus,
  removeStatus,
  resetPriorityColors,
  setPriorityColor,
  setSectionField,
  setSettingValue
} from "./settingsEditing.js";
import { defaultPriorityColors, defaultServiceOrderSettings } from "../../serviceOrderBoardUtils.js";

const statuses = [
  { id: "open", name: "Aberta", color: "#2563eb", order: 0, isInitial: true, isFinal: false },
  { id: "mid", name: "Meio", color: "#d97706", order: 1, isInitial: false, isFinal: false },
  { id: "closed", name: "Fim", color: "#16a34a", order: 2, isInitial: false, isFinal: true }
];
const settings = { ...defaultServiceOrderSettings, statuses };

describe("drop rules", () => {
  const configuredStatuses = statuses;
  it("nega sem permissão de alterar status ou de finalizar", () => {
    expect(getDropDenial({ targetStatus: "mid", configuredStatuses, canChangeStatus: false, canFinishOrders: true })).toContain(
      "alterar status"
    );
    expect(getDropDenial({ targetStatus: "closed", configuredStatuses, canChangeStatus: true, canFinishOrders: false })).toContain(
      "finalizar"
    );
    expect(getDropDenial({ targetStatus: "closed", configuredStatuses, canChangeStatus: true, canFinishOrders: true })).toBe("");
    expect(getDropDenial({ targetStatus: "mid", configuredStatuses, canChangeStatus: true, canFinishOrders: false })).toBe("");
  });
});

describe("order filters", () => {
  const orders = [
    {
      id: "1",
      sectorId: "sector-ti",
      assignedTechnicianNames: ["Ana"],
      createdBy: "u9",
      priority: "high",
      status: "open",
      title: "Rede",
      sla: { status: "breached" },
      environmentId: "c1",
      feedback: { rating: 3 }
    },
    {
      id: "2",
      sectorId: "sector-geral",
      assignedTechnicianName: "Bia",
      priority: "low",
      status: "closed",
      title: "Impressora",
      assetId: "a1",
      preventivePlanId: "p"
    },
    { id: "3", sectorId: "sector-rh", createdBy: "u1", priority: "high", status: "open", title: "Senha" }
  ];

  it("lista técnicos pela forma nova ou antiga", () => {
    expect(getTechnicianNames(orders[0])).toEqual(["Ana"]);
    expect(getTechnicianNames(orders[1])).toEqual(["Bia"]);
  });

  it("'Meu setor' considera setor, Geral, técnico e criador", () => {
    const user = { id: "u1", name: "Ana", sectorId: "sector-ti" };
    expect(orders.filter((order) => isOrderMine(order, user)).map((order) => order.id)).toEqual(["1", "2", "3"]);
    expect(orders.filter((order) => isOrderMine(order, { id: "z", name: "Z" })).map((order) => order.id)).toEqual(["2"]);
  });

  it("filtra por setor", () => {
    expect(filterBySector(orders, { sectorFilter: "all", canViewAllSectors: true, user: null })).toBe(orders);
    expect(filterBySector(orders, { sectorFilter: "sector-rh", canViewAllSectors: false, user: null }).map((order) => order.id)).toEqual([
      "3"
    ]);
    expect(filterBySector(orders, { sectorFilter: "", canViewAllSectors: false, user: null }).map((order) => order.id)).toEqual(["2"]);
    expect(filterBySector(orders, { sectorFilter: "all", canViewAllSectors: false, user: null }).map((order) => order.id)).toEqual([]);
  });

  it("combina filtros de catálogo", () => {
    const all = {
      businessMode: false,
      clientFilter: "all",
      priorityFilter: "all",
      technicianFilter: "all",
      statusFilter: "all",
      slaFilter: "all",
      originFilter: "all",
      ratingFilter: "all"
    };
    expect(filterByCatalog(orders, all)).toEqual(orders);
    expect(filterByCatalog(orders, { ...all, businessMode: true, clientFilter: "c1" }).map((order) => order.id)).toEqual(["1"]);
    expect(filterByCatalog(orders, { ...all, clientFilter: "c1" })).toHaveLength(3);
    expect(filterByCatalog(orders, { ...all, priorityFilter: "high" })).toHaveLength(2);
    expect(filterByCatalog(orders, { ...all, technicianFilter: "BIA" }).map((order) => order.id)).toEqual(["2"]);
    expect(filterByCatalog(orders, { ...all, statusFilter: "closed" }).map((order) => order.id)).toEqual(["2"]);
    expect(filterByCatalog(orders, { ...all, slaFilter: "not_applicable" }).map((order) => order.id)).toEqual(["2", "3"]);
    expect(filterByCatalog(orders, { ...all, originFilter: "preventive" }).map((order) => order.id)).toEqual(["2"]);
    expect(filterByCatalog(orders, { ...all, ratingFilter: "3" }).map((order) => order.id)).toEqual(["1"]);
    expect(filterByCatalog(orders, { ...all, ratingFilter: "none" }).map((order) => order.id)).toEqual(["2", "3"]);
  });

  it("pesquisa em OS e ativo sem acento", () => {
    const assetById = new Map([["a1", { name: "Servidor", ip: "10.1.1.1" }]]);
    expect(filterBySearch(orders, "", assetById)).toBe(orders);
    expect(filterBySearch(orders, "impressora", assetById).map((order) => order.id)).toEqual(["2"]);
    expect(filterBySearch(orders, "10.1.1", assetById).map((order) => order.id)).toEqual(["2"]);
    expect(filterBySearch(orders, "ana", assetById).map((order) => order.id)).toEqual(["1"]);
  });
});

describe("edição das configurações", () => {
  it("altera campos de seção, valores e cores", () => {
    expect(setSectionField(settings, "sla", "low", "5").sla.low).toBe("5");
    expect(setSettingValue(settings, "boardLayout", "vertical").boardLayout).toBe("vertical");
    expect(setPriorityColor(settings, "low", "#000000").priorityColors.low).toBe("#000000");
    expect(resetPriorityColors(setPriorityColor(settings, "low", "#000000")).priorityColors).toBe(defaultPriorityColors);
  });

  it("edita, acrescenta e remove status", () => {
    expect(patchStatus(settings, "mid", { name: "Novo nome" }).statuses[1].name).toBe("Novo nome");
    const added = appendStatus(settings, "novo");
    expect(added.statuses.map((status) => status.id)).toEqual(["open", "mid", "closed", "novo"]);
    expect(added.statuses[3]).toMatchObject({ name: "Novo status 4", color: "#64748b" });
    const full = {
      ...settings,
      statuses: Array.from({ length: 10 }, (_, index) => ({ id: `s${index}`, name: `S${index}`, order: index }))
    };
    expect(appendStatus(full, "extra")).toBeNull();
    expect(removeStatus(settings, "mid").statuses.map((status) => status.id)).toEqual(["open", "closed"]);
  });

  it("move status e respeita os limites da lista", () => {
    expect(moveStatusBy(settings, "mid", -1).statuses.map((status) => status.id)).toEqual(["mid", "open", "closed"]);
    expect(moveStatusBy(settings, "mid", 1).statuses.map((status) => status.id)).toEqual(["open", "closed", "mid"]);
    expect(moveStatusBy(settings, "open", -1)).toBe(settings);
    expect(moveStatusBy(settings, "closed", 1)).toBe(settings);
    expect(moveStatusBy(settings, "inexistente", 1)).toBe(settings);
  });

  it("troca os papéis de abertura e finalização", () => {
    const initial = assignStatusRole(settings, "mid", "initial").statuses;
    expect(initial.find((status) => status.id === "mid")).toMatchObject({ isInitial: true, isFinal: false });
    expect(initial.find((status) => status.id === "open").isInitial).toBe(false);
    const final = assignStatusRole(settings, "mid", "final").statuses;
    expect(final.find((status) => status.id === "mid")).toMatchObject({ isFinal: true, isInitial: false });
    expect(hasAnotherWithRole(statuses, "open", "initial")).toBe(false);
    expect(hasAnotherWithRole(statuses, "mid", "initial")).toBe(true);
    expect(hasAnotherWithRole(statuses, "mid", "final")).toBe(true);
    expect(getRoleReplaceMessage("initial")).toContain("abertura");
    expect(getRoleReplaceMessage("final")).toContain("finalização");
  });

  it("explica por que um status não pode ser excluído", () => {
    expect(getStatusDeletionBlock(statuses, [], "nada")).toEqual({ status: null, message: "" });
    expect(getStatusDeletionBlock(statuses.slice(0, 2), [], "open").message).toContain("pelo menos um status");
    expect(getStatusDeletionBlock(statuses, [{ status: "mid" }], "mid").message).toContain("Mova as OS");
    expect(getStatusDeletionBlock(statuses, [], "mid")).toMatchObject({ status: { id: "mid" }, message: "" });
  });
});
