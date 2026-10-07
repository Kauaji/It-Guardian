import { describe, expect, it } from "vitest";
import {
  buildMaintenanceOrderPayload,
  buildMaintenanceRecord,
  hasOpenMaintenanceOrder,
  resolveServiceOrderTargetTabId
} from "./maintenanceEntryModel.js";

describe("maintenanceEntryModel", () => {
  it("buildMaintenanceRecord guarda a origem da maquina", () => {
    expect(buildMaintenanceRecord({ tabId: "t", groupId: "g", segmentId: "s", segmentName: "Redes" })).toEqual({
      active: true,
      origin: { tabId: "t", groupId: "g", segmentId: "s", segmentName: "Redes" }
    });
  });

  it("resolveServiceOrderTargetTabId prefere a aba da maquina, exceto nao organizadas", () => {
    const active = { id: "ativa" };
    expect(resolveServiceOrderTargetTabId({ tabId: "t1" }, { environmentId: "e" }, active)).toBe("t1");
    expect(resolveServiceOrderTargetTabId({ tabId: "global-unorganized" }, { environmentId: "e" }, active)).toBe("e");
    expect(resolveServiceOrderTargetTabId({}, {}, active)).toBe("ativa");
  });

  it("hasOpenMaintenanceOrder ignora outras maquinas, outras categorias e OS fechadas", () => {
    const orders = [
      { assetId: "d1", category: "Manutencao", status: "closed" },
      { assetId: "d2", category: "Manutencao", status: "open" },
      { assetId: "d1", category: "Rede", status: "open" }
    ];
    expect(hasOpenMaintenanceOrder(orders, "d1")).toBe(false);
    expect(hasOpenMaintenanceOrder([...orders, { assetId: "d1", category: "Manutencao", status: "open" }], "d1")).toBe(true);
    expect(hasOpenMaintenanceOrder([], "d1")).toBe(false);
    // quirk preservado (ver serviceOrderRules.test.js): a categoria acentuada nao conta
    expect(hasOpenMaintenanceOrder([{ assetId: "d1", category: "Manutenção", status: "open" }], "d1")).toBe(false);
  });

  it("buildMaintenanceOrderPayload monta a OS de manutencao com o nome padrao do ambiente", () => {
    const payload = buildMaintenanceOrderPayload({
      machine: { id: "d1", name: "PC-01" },
      activeInventoryTab: { id: "tab" },
      user: { name: "Ana" },
      previousSegment: "Redes"
    });
    expect(payload).toMatchObject({
      title: "Manutenção - PC-01",
      category: "Manutenção",
      priority: "medium",
      assetId: "d1",
      environmentId: "tab",
      environmentName: "Novo ambiente",
      requesterName: "Ana",
      notes: "Origem: Redes"
    });
    expect(payload.description).toContain("PC-01");
  });
});
