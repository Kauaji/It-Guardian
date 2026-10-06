import { describe, expect, it } from "vitest";
import { buildAlertCenterPermissions } from "./alertPermissions.js";

const canOnly =
  (...granted) =>
  (permission) =>
    granted.includes(permission);

describe("buildAlertCenterPermissions", () => {
  it("nega tudo quando o usuário não tem permissões", () => {
    const perms = buildAlertCenterPermissions(() => false, false);

    expect(Object.entries(perms).filter(([key, value]) => key !== "remoteScriptExecutionEnabled" && value)).toEqual([]);
    expect(perms.remoteScriptExecutionEnabled).toBe(false);
  });

  it("libera tudo para quem tem todas as permissões", () => {
    const perms = buildAlertCenterPermissions(() => true, true);

    expect(Object.values(perms).every(Boolean)).toBe(true);
  });

  it("exige as duas permissões para gerenciar sugestões", () => {
    expect(buildAlertCenterPermissions(canOnly("alerts.manage_suggestions"), false).canManageSuggestions).toBe(false);
    expect(buildAlertCenterPermissions(canOnly("service_orders.create_from_alert"), false).canManageSuggestions).toBe(false);
    expect(
      buildAlertCenterPermissions(canOnly("alerts.manage_suggestions", "service_orders.create_from_alert"), false).canManageSuggestions
    ).toBe(true);
  });

  it("exige criar e preparar para registrar preventivas", () => {
    expect(buildAlertCenterPermissions(canOnly("preventive_plans.create"), false).canCreatePreventivePlans).toBe(false);
    expect(
      buildAlertCenterPermissions(canOnly("preventive_plans.create", "preventive_plans.prepare"), false).canCreatePreventivePlans
    ).toBe(true);
  });

  it("exige criar OS preventiva e criar OS em geral", () => {
    expect(buildAlertCenterPermissions(canOnly("preventive_plans.create_service_order"), false).canCreatePreventiveServiceOrder).toBe(
      false
    );
    expect(
      buildAlertCenterPermissions(canOnly("preventive_plans.create_service_order", "service_orders.create"), false)
        .canCreatePreventiveServiceOrder
    ).toBe(true);
  });

  it("só permite usar scripts nos avisos com a execução remota habilitada", () => {
    const can = canOnly("scripts.use_from_alert");

    expect(buildAlertCenterPermissions(can, false).canUseScriptsFromAlerts).toBe(false);
    expect(buildAlertCenterPermissions(can, true).canUseScriptsFromAlerts).toBe(true);
    expect(buildAlertCenterPermissions(() => false, true).canUseScriptsFromAlerts).toBe(false);
  });

  it("deriva a área preventiva e as configurações", () => {
    expect(buildAlertCenterPermissions(canOnly("preventive_plans.view"), false).canUsePreventiveArea).toBe(true);
    expect(buildAlertCenterPermissions(canOnly("preventive_automation.view"), false).canUsePreventiveArea).toBe(true);
    expect(buildAlertCenterPermissions(canOnly("alerts.view"), false).canUsePreventiveArea).toBe(false);
    expect(buildAlertCenterPermissions(canOnly("alerts.configure"), false).canOpenSettings).toBe(true);
    expect(buildAlertCenterPermissions(canOnly("scripts.manage"), false).canOpenSettings).toBe(true);
    expect(buildAlertCenterPermissions(canOnly("scripts.view"), false).canOpenSettings).toBe(false);
  });
});
