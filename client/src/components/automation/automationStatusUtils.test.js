import { describe, expect, it } from "vitest";
import {
  automationPlanHasError,
  automationPlanWithoutSchedule,
  formatAutomationMachineStatusSummary,
  getAutomationMachineStatusSummary,
  machineMatchesAutomationStatus
} from "./automationStatusUtils.js";

function buildMachine(plans) {
  return { plans };
}

describe("automationPlanHasError", () => {
  it("retorna false quando o plano nao tem nenhum indicador de erro", () => {
    expect(automationPlanHasError({})).toBe(false);
    expect(automationPlanHasError({ status: "ok", assetSchedules: [] })).toBe(false);
  });

  it("retorna true quando o status do proprio plano e error ou failed", () => {
    expect(automationPlanHasError({ status: "error" })).toBe(true);
    expect(automationPlanHasError({ status: "Failed" })).toBe(true);
  });

  it("retorna true quando o latestRun do plano indica erro", () => {
    expect(automationPlanHasError({ latestRun: { status: "error" } })).toBe(true);
    expect(automationPlanHasError({ latestRun: { errorDetected: true } })).toBe(true);
  });

  it("retorna true quando errorAssetCount e maior que zero", () => {
    expect(automationPlanHasError({ errorAssetCount: 2 })).toBe(true);
    expect(automationPlanHasError({ errorAssetCount: 0 })).toBe(false);
  });

  it("retorna true quando algum assetSchedule esta com erro, mesmo com o plano ok", () => {
    const plan = {
      status: "ok",
      assetSchedules: [
        { status: "ok", latestRun: { status: "ok" } },
        { status: "ok", latestRun: { status: "failed" } }
      ]
    };
    expect(automationPlanHasError(plan)).toBe(true);
  });
});

describe("automationPlanWithoutSchedule", () => {
  it("retorna false imediatamente quando o plano esta inativo, mesmo com contagem pendente", () => {
    expect(automationPlanWithoutSchedule({ active: false, withoutScheduleCount: 5 })).toBe(false);
  });

  it("retorna true quando withoutScheduleCount do plano e maior que zero", () => {
    expect(automationPlanWithoutSchedule({ withoutScheduleCount: 2 })).toBe(true);
  });

  it("retorna true para um plano vazio, sem nextRunAt e sem assetSchedules", () => {
    expect(automationPlanWithoutSchedule({})).toBe(true);
  });

  it("retorna false quando o plano e todos os assetSchedules ativos tem nextRunAt", () => {
    const plan = {
      nextRunAt: "2026-08-20T00:00:00Z",
      assetSchedules: [{ active: true, nextRunAt: "2026-08-21T00:00:00Z" }]
    };
    expect(automationPlanWithoutSchedule(plan)).toBe(false);
  });

  it("retorna true quando existe assetSchedule ativo sem nextRunAt", () => {
    const plan = {
      nextRunAt: "2026-08-20T00:00:00Z",
      assetSchedules: [{ active: true, nextRunAt: null }]
    };
    expect(automationPlanWithoutSchedule(plan)).toBe(true);
  });

  it("ignora assetSchedules inativos ao verificar agenda pendente", () => {
    const plan = {
      nextRunAt: "2026-08-20T00:00:00Z",
      assetSchedules: [{ active: false, nextRunAt: null }]
    };
    expect(automationPlanWithoutSchedule(plan)).toBe(false);
  });
});

describe("getAutomationMachineStatusSummary", () => {
  it("retorna contagens zeradas quando a maquina nao tem planos", () => {
    expect(getAutomationMachineStatusSummary({})).toEqual({
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      errorCount: 0,
      withoutScheduleCount: 0
    });
  });

  it("soma ativos, inativos, com erro e sem agenda a partir de planos mistos", () => {
    const machine = buildMachine([
      { active: true, nextRunAt: "2026-08-20T00:00:00Z", status: "ok" },
      { active: false, status: "ok" },
      { active: true, status: "error" },
      { active: true, nextRunAt: "2026-08-21T00:00:00Z", status: "ok" }
    ]);

    expect(getAutomationMachineStatusSummary(machine)).toEqual({
      totalCount: 4,
      activeCount: 3,
      inactiveCount: 1,
      errorCount: 1,
      withoutScheduleCount: 1
    });
  });

  it("conta planos ativos sem nextRunAt como com erro e sem agenda ao mesmo tempo", () => {
    const machine = buildMachine([
      { active: true, status: "failed" },
      { active: true, errorAssetCount: 2 }
    ]);

    expect(getAutomationMachineStatusSummary(machine)).toEqual({
      totalCount: 2,
      activeCount: 2,
      inactiveCount: 0,
      errorCount: 2,
      withoutScheduleCount: 2
    });
  });
});

describe("machineMatchesAutomationStatus", () => {
  const mixedMachine = buildMachine([
    { active: true, nextRunAt: "2026-08-20T00:00:00Z", status: "ok" },
    { active: false, status: "ok" },
    { active: true, status: "error" },
    { active: true, nextRunAt: "2026-08-21T00:00:00Z", status: "ok" }
  ]);

  it("status all so corresponde quando a maquina tem pelo menos um plano", () => {
    expect(machineMatchesAutomationStatus(mixedMachine, "all")).toBe(true);
    expect(machineMatchesAutomationStatus(buildMachine([]), "all")).toBe(false);
  });

  it("status active corresponde quando ha pelo menos um plano ativo", () => {
    expect(machineMatchesAutomationStatus(mixedMachine, "active")).toBe(true);
  });

  it("status error corresponde quando ha pelo menos um plano com erro", () => {
    expect(machineMatchesAutomationStatus(mixedMachine, "error")).toBe(true);
  });

  it("nao corresponde a inactive, error ou without_schedule quando a maquina nao tem plano nesse estado", () => {
    const healthyMachine = buildMachine([
      { active: true, nextRunAt: "2026-08-20T00:00:00Z", status: "ok" }
    ]);
    expect(machineMatchesAutomationStatus(healthyMachine, "inactive")).toBe(false);
    expect(machineMatchesAutomationStatus(healthyMachine, "error")).toBe(false);
    expect(machineMatchesAutomationStatus(healthyMachine, "without_schedule")).toBe(false);
  });

  it("retorna false para um filtro de status desconhecido", () => {
    expect(machineMatchesAutomationStatus(mixedMachine, "unknown")).toBe(false);
  });
});

describe("formatAutomationMachineStatusSummary", () => {
  it("retorna 'Sem planos' quando a maquina nao tem nenhum plano", () => {
    expect(formatAutomationMachineStatusSummary({})).toBe("Sem planos");
  });

  it("formata contagens mistas com pluralizacao correta, separadas por bullet", () => {
    const machine = buildMachine([
      { active: true, nextRunAt: "2026-08-20T00:00:00Z", status: "ok" },
      { active: false, status: "ok" },
      { active: true, status: "error" },
      { active: true, nextRunAt: "2026-08-21T00:00:00Z", status: "ok" }
    ]);

    expect(formatAutomationMachineStatusSummary(machine)).toBe(
      "3 ativos • 1 inativo • 1 com erro • 1 sem agenda"
    );
  });

  it("usa singular quando ha apenas um plano ativo e nenhum outro estado presente", () => {
    const machine = buildMachine([
      { active: true, nextRunAt: "2026-08-20T00:00:00Z", status: "ok" }
    ]);

    expect(formatAutomationMachineStatusSummary(machine)).toBe("1 ativo");
  });
});
