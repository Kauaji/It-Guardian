import { describe, expect, it } from "vitest";
import { buildCalendarDays, eventsByDay, getCalendarRange } from "./calendarModel.js";

describe("calendarModel", () => {
  it("monta 42 dias para a grade mensal", () => expect(buildCalendarDays(new Date(2026, 8, 2), "month")).toHaveLength(42));
  it("monta sete dias para a semana", () => expect(buildCalendarDays(new Date(2026, 8, 2), "week")).toHaveLength(7));
  it("retorna intervalo diário", () => expect(getCalendarRange(new Date(2026, 8, 2), "day").end.getDate()).toBe(3));
  it("agrupa eventos por data", () => expect(eventsByDay([{ id: "1", startAt: "2026-09-02T12:00:00" }]).size).toBe(1));
});
