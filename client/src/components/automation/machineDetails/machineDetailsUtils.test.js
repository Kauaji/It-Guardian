import { describe, expect, it } from "vitest";
import { deriveMachineDetailView, recurrenceOriginLabel } from "./machineDetailsUtils.js";

describe("recurrenceOriginLabel", () => {
  it("descreve a origem da recorrência", () => {
    expect(recurrenceOriginLabel("machine")).toBe("Personalizada para esta máquina");
    expect(recurrenceOriginLabel("segment")).toBe("Herdada do segmento");
    expect(recurrenceOriginLabel("plan")).toBe("Herdada do plano");
    expect(recurrenceOriginLabel(undefined)).toBe("Herdada do plano");
  });
});

describe("deriveMachineDetailView", () => {
  const plan = { id: "p1", assetCount: 3, hasCustomOverride: true };

  it("usa o plano como contingência enquanto o detalhe não chega", () => {
    const view = deriveMachineDetailView(plan, null);

    expect(view.displayedSchedule).toBe(plan);
    expect(view.hasCustomOverride).toBe(true);
    expect(view.isLastPlanAsset).toBe(false);
    expect(view.effectiveOrigin).toBe("machine");
  });

  it("usa a agenda e o override do detalhe quando carregado", () => {
    const detail = { schedule: { recurrenceSource: "segment" }, override: { active: false }, plan: { assetCount: 1 } };
    const view = deriveMachineDetailView({ id: "p1" }, detail);

    expect(view.displayedSchedule).toBe(detail.schedule);
    expect(view.hasCustomOverride).toBe(false);
    expect(view.effectiveOrigin).toBe("segment");
    expect(view.isLastPlanAsset).toBe(true);
  });

  it("deduz a origem pelo override quando a agenda não informa", () => {
    expect(deriveMachineDetailView({ id: "p" }, { schedule: {}, override: { active: true } }).effectiveOrigin).toBe("machine");
    expect(deriveMachineDetailView({ id: "p" }, { schedule: {}, override: null }).effectiveOrigin).toBe("plan");
  });

  it("considera a última máquina quando a contagem é 0 ou 1", () => {
    expect(deriveMachineDetailView({ id: "p", assetCount: 1 }, null).isLastPlanAsset).toBe(true);
    expect(deriveMachineDetailView({ id: "p" }, null).isLastPlanAsset).toBe(true);
    expect(deriveMachineDetailView({ id: "p", assetCount: 2 }, null).isLastPlanAsset).toBe(false);
  });
});
