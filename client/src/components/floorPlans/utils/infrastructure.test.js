import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBackgroundScaleSettings,
  buildInfrastructureFilters,
  filterCompatibleSegments,
  getInfrastructurePeriodRange,
  isSegmentCompatibleWithGroup,
  isValidBackgroundFile
} from "./infrastructure.js";

describe("getInfrastructurePeriodRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 10, 30, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("usa os ultimos N dias (30 por padrao)", () => {
    const week = getInfrastructurePeriodRange("7");
    expect(new Date(week.endDate).getTime() - new Date(week.startDate).getTime()).toBe(7 * 24 * 3600 * 1000);
    const fallback = getInfrastructurePeriodRange(undefined);
    expect(new Date(fallback.endDate).getTime() - new Date(fallback.startDate).getTime()).toBe(30 * 24 * 3600 * 1000);
  });

  it("mes atual comeca no dia 1 a meia-noite e termina agora", () => {
    const range = getInfrastructurePeriodRange("current_month");
    expect(new Date(range.startDate)).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
    expect(new Date(range.endDate)).toEqual(new Date(2026, 4, 15, 10, 30, 0));
  });

  it("mes anterior vai do dia 1 do mes passado ao dia 1 deste mes", () => {
    const range = getInfrastructurePeriodRange("previous_month");
    expect(new Date(range.startDate)).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
    expect(new Date(range.endDate)).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
  });
});

describe("segmentos compativeis", () => {
  const segments = [
    { id: "a", groupId: "g1" },
    { id: "b", groupId: "g2" },
    { id: "c", groupId: null }
  ];

  it("aceita segmentos sem grupo ou do mesmo grupo", () => {
    expect(isSegmentCompatibleWithGroup(segments[0], "g1")).toBe(true);
    expect(isSegmentCompatibleWithGroup(segments[1], "g1")).toBe(false);
    expect(isSegmentCompatibleWithGroup(segments[2], "g1")).toBe(true);
    expect(isSegmentCompatibleWithGroup(segments[1], "")).toBe(true);
  });

  it("filtra a lista e devolve tudo sem grupo escolhido", () => {
    expect(filterCompatibleSegments(segments, "g1").map((segment) => segment.id)).toEqual(["a", "c"]);
    expect(filterCompatibleSegments(segments, "")).toBe(segments);
  });
});

describe("filtros e fundo", () => {
  it("monta filtros apenas com o que foi escolhido", () => {
    expect(buildInfrastructureFilters("", "")).toEqual({});
    expect(buildInfrastructureFilters("g1", "")).toEqual({ groupId: "g1" });
    expect(buildInfrastructureFilters("g1", "s1")).toEqual({ groupId: "g1", segmentId: "s1" });
  });

  it("escala o fundo proporcionalmente ao pavimento", () => {
    expect(buildBackgroundScaleSettings({ opacity: 0.5 }, { width: 1000, height: 500 }, 1.5)).toEqual({
      opacity: 0.5,
      scale: 1.5,
      width: 1500,
      height: 750
    });
    expect(buildBackgroundScaleSettings({}, null, 1)).toMatchObject({ width: 1280, height: 820 });
  });

  it("valida tipo e tamanho do arquivo de fundo", () => {
    expect(isValidBackgroundFile({ type: "image/png", size: 1024 })).toBe(true);
    expect(isValidBackgroundFile({ type: "image/webp", size: 8 * 1024 * 1024 })).toBe(true);
    expect(isValidBackgroundFile({ type: "image/gif", size: 1024 })).toBe(false);
    expect(isValidBackgroundFile({ type: "image/jpeg", size: 8 * 1024 * 1024 + 1 })).toBe(false);
    expect(isValidBackgroundFile(null)).toBe(false);
  });
});
