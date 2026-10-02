import { describe, expect, it } from "vitest";
import {
  applyOrderedIds,
  assignDevicesToTab,
  mergeInventoryMeta,
  reassignTabMeta
} from "./inventoryMeta.js";

describe("mergeInventoryMeta", () => {
  it("mescla campos sem perder os existentes nem as outras colecoes", () => {
    const current = { segments: { s1: { order: 1 } }, groups: { g1: { tabId: "t" } } };
    const next = mergeInventoryMeta(current, "segments", "s1", { tabId: "tab-a" });
    expect(next.segments.s1).toEqual({ order: 1, tabId: "tab-a" });
    expect(next.groups).toBe(current.groups);
  });

  it("cria a colecao quando ela ainda nao existe", () => {
    expect(mergeInventoryMeta({}, "devices", "d1", { order: 0 })).toEqual({ devices: { d1: { order: 0 } } });
  });
});

describe("assignDevicesToTab", () => {
  it("grava a aba de destino em segmentos comuns", () => {
    const next = assignDevicesToTab({ devices: {} }, ["d1", "d2"], { isDefault: false }, "tab-a");
    expect(next.devices).toEqual({ d1: { tabId: "tab-a" }, d2: { tabId: "tab-a" } });
  });

  it("aceita um unico id e ignora ids vazios", () => {
    expect(assignDevicesToTab({}, "d1", {}, "tab-a").devices).toEqual({ d1: { tabId: "tab-a" } });
    expect(assignDevicesToTab({}, [null, "d1"], {}, "tab-a").devices).toEqual({ d1: { tabId: "tab-a" } });
  });

  it("ao mover para o segmento padrao remove a aba e descarta metadado vazio", () => {
    const current = { devices: { d1: { tabId: "tab-a" }, d2: { tabId: "tab-a", order: 3 } } };
    const next = assignDevicesToTab(current, ["d1", "d2"], { isDefault: true }, "tab-b");
    expect(next.devices).toEqual({ d2: { order: 3 } });
  });
});

describe("applyOrderedIds", () => {
  it("regrava a ordem e a aba dos ids informados", () => {
    const current = { groups: { a: { order: 9, color: "x" }, z: { order: 1 } } };
    const next = applyOrderedIds(current, "groups", ["b", "a"], "tab-a");
    expect(next.groups).toEqual({
      a: { order: 1, color: "x", tabId: "tab-a" },
      b: { order: 0, tabId: "tab-a" },
      z: { order: 1 }
    });
  });
});

describe("reassignTabMeta", () => {
  it("move para a aba de destino tudo que era da aba excluida", () => {
    const current = {
      groups: { g1: { tabId: "old", order: 0 }, g2: { tabId: "keep" } },
      segments: { s1: { tabId: "old" } },
      devices: undefined
    };
    expect(reassignTabMeta(current, "old", "new")).toEqual({
      groups: { g1: { tabId: "new", order: 0 }, g2: { tabId: "keep" } },
      segments: { s1: { tabId: "new" } },
      devices: {}
    });
  });
});
