import { describe, expect, it } from "vitest";
import {
  buildQueryParams,
  buildServiceOrderDefaults,
  countActiveFilters,
  dayCellClassName,
  dayPriorityColor,
  EMPTY_FILTERS,
  filterEventsBySearch,
  filterSegmentsFor,
  formatEventTime,
  formatHeader,
  highestPriority,
  shiftMonth
} from "./calendarPage.js";

describe("calendarPage", () => {
  it("formata o cabeçalho do mês em português", () => {
    expect(formatHeader(new Date(2026, 8, 15))).toBe("setembro de 2026");
  });

  it("avança e recua meses sem alterar a âncora original", () => {
    const anchor = new Date(2026, 8, 15);
    expect(shiftMonth(anchor, 1).getMonth()).toBe(9);
    expect(shiftMonth(anchor, -1).getMonth()).toBe(7);
    expect(anchor.getMonth()).toBe(8);
  });

  it("filtra segmentos selecionáveis pelo grupo", () => {
    const segments = [
      { id: "a", name: "A", groupId: "g1" },
      { id: "b", name: "B", groupId: "g2" },
      { id: "c", name: "C" },
      { id: "d", name: "Manutenção", groupId: "g1" },
      { id: "e", name: "E", isDefault: true }
    ];
    expect(filterSegmentsFor(segments, "").map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(filterSegmentsFor(segments, "g1").map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("conta filtros ativos ignorando a busca e monta parâmetros só com valores preenchidos", () => {
    const filters = { ...EMPTY_FILTERS, search: "x", status: "completed", priority: "high" };
    expect(countActiveFilters(filters)).toBe(2);
    const range = { start: new Date("2026-08-30T00:00:00Z"), end: new Date("2026-10-11T00:00:00Z") };
    expect(buildQueryParams(range, filters)).toEqual({
      startDate: "2026-08-30T00:00:00.000Z",
      endDate: "2026-10-11T00:00:00.000Z",
      status: "completed",
      priority: "high"
    });
  });

  it("busca eventos sem diferenciar caixa e ignora busca vazia", () => {
    const events = [{ title: "Troca de SWITCH" }, { description: "cabo" }, { serviceOrderNumber: "OS-1" }, { technicianName: "Ana" }, {}];
    expect(filterEventsBySearch(events, "   ")).toBe(events);
    expect(filterEventsBySearch(events, "switch")).toHaveLength(1);
    expect(filterEventsBySearch(events, "CABO")).toHaveLength(1);
    expect(filterEventsBySearch(events, "os-1")).toHaveLength(1);
    expect(filterEventsBySearch(events, "ana")).toHaveLength(1);
  });

  it("gera os padrões do formulário de uma OS em foco", () => {
    expect(buildServiceOrderDefaults({ id: "1", number: "OS-1", title: "Rede" })).toEqual({
      title: "Atendimento OS-1 · Rede",
      eventType: "service_order",
      serviceOrderId: "1",
      assetId: ""
    });
    expect(buildServiceOrderDefaults({ id: "1", number: "OS-1", title: "Rede", assetId: "d" }).assetId).toBe("d");
  });

  it("calcula a maior prioridade do dia e a cor correspondente", () => {
    expect(highestPriority([])).toBe("");
    expect(highestPriority([{ priority: "low" }, { priority: "urgent" }, { priority: "high" }, { priority: "x" }])).toBe("urgent");
    expect(dayPriorityColor([])).toBe("transparent");
    expect(dayPriorityColor([{ priority: "high" }])).toBe("#d97706");
  });

  it("classifica as células do dia", () => {
    const anchor = new Date(2026, 8, 15);
    expect(dayCellClassName(new Date(2000, 0, 1), anchor, [])).toContain("outside");
    expect(dayCellClassName(new Date(2000, 0, 1), anchor, [])).toContain("past");
    expect(dayCellClassName(new Date(), new Date(), [{}])).toContain("has-events");
    expect(dayCellClassName(new Date(), new Date(), [])).toContain("today");
  });

  it("formata o horário do evento", () => {
    expect(formatEventTime({ allDay: true })).toBe("Dia");
    expect(formatEventTime({ startAt: new Date(2026, 8, 1, 7, 5).toISOString() })).toMatch(/07:05/);
  });
});
