import { describe, expect, it } from "vitest";
import { deviceLabel, formatDate, getDeviceStatusTone, getDeviceTags, getEntityKindLabel, planStatusLabel } from "./planPresentation.js";
import { createId } from "./ids.js";
import { DEFAULT_FLOOR_PLAN_LAYERS, FLOOR_PLAN_LAYER_OPTIONS, resolveLayerState } from "./layers.js";
import { getObjectResizeHandles } from "./selectionHandles.js";

describe("apresentacao", () => {
  it("rotula o status da planta", () => {
    expect(planStatusLabel("active")).toBe("Ativa");
    expect(planStatusLabel("archived")).toBe("Arquivada");
    expect(planStatusLabel("custom")).toBe("custom");
    expect(planStatusLabel(undefined)).toBe("Rascunho");
  });

  it("formata datas em pt-BR ou informa ausencia", () => {
    expect(formatDate(null)).toBe("Não informado");
    expect(formatDate("2026-03-05T14:07:00")).toMatch(/05\/03.*14:07/);
  });

  it("escolhe o melhor nome do ativo", () => {
    expect(deviceLabel({ displayName: "A", name: "B" })).toBe("A");
    expect(deviceLabel({ hostname: "srv", id: "1" })).toBe("srv");
    expect(deviceLabel({ id: "1" })).toBe("1");
    expect(deviceLabel(null)).toBe("Ativo");
  });

  it("rotula o tipo da entidade no inspetor", () => {
    expect(getEntityKindLabel("object")).toBe("Ativo/objeto");
    expect(getEntityKindLabel("zone")).toBe("Zona");
    expect(getEntityKindLabel("point")).toBe("Ponto");
    expect(getEntityKindLabel("route")).toBe("Rota");
  });

  it("classifica o tom do status do ativo", () => {
    expect(getDeviceStatusTone("Online")).toBe("online");
    expect(getDeviceStatusTone("ativo")).toBe("online");
    expect(getDeviceStatusTone("Problema")).toBe("warning");
    expect(getDeviceStatusTone("erro")).toBe("warning");
    expect(getDeviceStatusTone("offline")).toBe("offline");
    expect(getDeviceStatusTone("")).toBe("neutral");
    expect(getDeviceStatusTone(undefined)).toBe("neutral");
  });

  it("le tags em lista ou texto", () => {
    expect(getDeviceTags({ tags: ["a", "b"] })).toEqual(["a", "b"]);
    expect(getDeviceTags({ tags: " a, b ,, c " })).toEqual(["a", "b", "c"]);
    expect(getDeviceTags(null)).toEqual([]);
  });
});

describe("camadas e ids", () => {
  it("expoe seis camadas visiveis por padrao", () => {
    expect(FLOOR_PLAN_LAYER_OPTIONS).toHaveLength(6);
    expect(Object.values(DEFAULT_FLOOR_PLAN_LAYERS).every(Boolean)).toBe(true);
    expect(resolveLayerState({ labels: false })).toMatchObject({ labels: false, rooms: true });
    expect(resolveLayerState(null)).toEqual(DEFAULT_FLOOR_PLAN_LAYERS);
  });

  it("gera ids unicos com prefixo", () => {
    const first = createId("object");
    const second = createId("object");
    expect(first).toMatch(/^object-/);
    expect(first).not.toBe(second);
  });
});

describe("getObjectResizeHandles", () => {
  it("devolve quatro laterais e quatro cantos ao redor do objeto", () => {
    const handles = getObjectResizeHandles({ x: 100, y: 50, width: 80, height: 40 });
    expect(handles.map((handle) => handle.side)).toEqual([
      "north",
      "east",
      "south",
      "west",
      "northwest",
      "northeast",
      "southeast",
      "southwest"
    ]);
    expect(handles[0]).toMatchObject({ x: 140, y: 32 });
    expect(handles[6]).toMatchObject({ x: 188, y: 98 });
  });
});
