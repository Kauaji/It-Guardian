import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  filterTimelineEvents,
  groupTimelineEventsByDay,
  matchesTimelineSearch,
  mergeObservationsIntoEvents,
  severityToken
} from "./assetTimelineModel.js";

function makeEvent(overrides = {}) {
  return {
    id: "event-1",
    occurredAt: "2026-01-10T10:00:00.000Z",
    category: "service_order",
    type: "service_order_created",
    title: "OS #0001 aberta",
    description: "Computador nao liga",
    actorName: "Maria",
    severity: "info",
    ...overrides
  };
}

describe("categoryLabel", () => {
  it("retorna o rotulo em portugues para categorias conhecidas", () => {
    expect(categoryLabel("service_order")).toBe("OS");
    expect(categoryLabel("remote_assistance")).toBe("Assistência remota");
  });

  it("cai em Sistema para categorias desconhecidas", () => {
    expect(categoryLabel("algo-inexistente")).toBe("Sistema");
  });
});

describe("severityToken", () => {
  it("retorna o token conhecido ou neutral como fallback", () => {
    expect(severityToken("critical")).toBe("critical");
    expect(severityToken("inexistente")).toBe("neutral");
  });
});

describe("matchesTimelineSearch", () => {
  it("retorna true quando a busca esta vazia", () => {
    expect(matchesTimelineSearch(makeEvent(), "")).toBe(true);
  });

  it("busca por titulo, descricao e autor sem diferenciar maiusculas", () => {
    const event = makeEvent();
    expect(matchesTimelineSearch(event, "nao liga")).toBe(true);
    expect(matchesTimelineSearch(event, "MARIA")).toBe(true);
    expect(matchesTimelineSearch(event, "inexistente")).toBe(false);
  });
});

describe("filterTimelineEvents", () => {
  const events = [
    makeEvent({ id: "1", category: "service_order", title: "OS aberta" }),
    makeEvent({ id: "2", category: "alert", title: "Disco critico", description: "" })
  ];

  it("filtra por categoria", () => {
    const result = filterTimelineEvents(events, { category: "alert" });
    expect(result.map((event) => event.id)).toEqual(["2"]);
  });

  it("combina categoria e busca textual", () => {
    const result = filterTimelineEvents(events, { category: "all", queryText: "disco" });
    expect(result.map((event) => event.id)).toEqual(["2"]);
  });
});

describe("groupTimelineEventsByDay", () => {
  it("agrupa eventos pelo mesmo dia preservando a ordem de entrada", () => {
    const events = [
      makeEvent({ id: "1", occurredAt: "2026-01-10T09:00:00.000Z" }),
      makeEvent({ id: "2", occurredAt: "2026-01-10T18:00:00.000Z" }),
      makeEvent({ id: "3", occurredAt: "2026-01-09T09:00:00.000Z" })
    ];

    const groups = groupTimelineEventsByDay(events);

    expect(groups).toHaveLength(2);
    expect(groups[0].events.map((event) => event.id)).toEqual(["1", "2"]);
    expect(groups[1].events.map((event) => event.id)).toEqual(["3"]);
  });
});

describe("mergeObservationsIntoEvents", () => {
  it("converte observacoes em eventos de categoria observation e reordena por data", () => {
    const events = [makeEvent({ id: "1", occurredAt: "2026-01-05T00:00:00.000Z" })];
    const observations = [
      { id: "obs-1", text: "Trocado o cabo de rede", user: "Joao", createdAt: "2026-01-12T00:00:00.000Z" }
    ];

    const merged = mergeObservationsIntoEvents(events, observations);

    expect(merged).toHaveLength(2);
    expect(merged[0].category).toBe("observation");
    expect(merged[0].description).toBe("Trocado o cabo de rede");
    expect(merged[0].actorName).toBe("Joao");
  });

  it("nao quebra quando nao ha observacoes", () => {
    const events = [makeEvent()];
    expect(mergeObservationsIntoEvents(events)).toEqual(events);
  });
});
