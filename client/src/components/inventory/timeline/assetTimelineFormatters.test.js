import { describe, expect, it } from "vitest";
import { formatDayLabel, formatEventDateTime, formatRelativeTime } from "./assetTimelineFormatters.js";

describe("formatEventDateTime", () => {
  it("formata uma data ISO valida em pt-BR", () => {
    const formatted = formatEventDateTime("2026-01-10T14:30:00.000Z");
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("retorna string vazia para data invalida", () => {
    expect(formatEventDateTime("nao-e-uma-data")).toBe("");
  });
});

describe("formatDayLabel", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  it("retorna Hoje para o dia atual", () => {
    expect(formatDayLabel("2026-01-10T08:00:00.000Z", now)).toBe("Hoje");
  });

  it("retorna Ontem para o dia anterior", () => {
    expect(formatDayLabel("2026-01-09T08:00:00.000Z", now)).toBe("Ontem");
  });

  it("retorna a data completa para dias mais antigos", () => {
    const label = formatDayLabel("2026-01-01T08:00:00.000Z", now);
    expect(label).toContain("2026");
    expect(label).not.toBe("Hoje");
    expect(label).not.toBe("Ontem");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  it("retorna agora mesmo para eventos com menos de um minuto", () => {
    expect(formatRelativeTime("2026-01-10T11:59:30.000Z", now)).toBe("agora mesmo");
  });

  it("retorna minutos para eventos recentes", () => {
    expect(formatRelativeTime("2026-01-10T11:45:00.000Z", now)).toBe("há 15 min");
  });

  it("retorna horas para eventos do mesmo dia", () => {
    expect(formatRelativeTime("2026-01-10T09:00:00.000Z", now)).toBe("há 3 h");
  });

  it("retorna dias para eventos dentro do mesmo mes", () => {
    expect(formatRelativeTime("2026-01-05T12:00:00.000Z", now)).toBe("há 5 d");
  });

  it("cai na data absoluta para eventos muito antigos", () => {
    const label = formatRelativeTime("2025-01-01T12:00:00.000Z", now);
    expect(label).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
