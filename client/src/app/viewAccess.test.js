import { describe, expect, it } from "vitest";
import {
  calendarPermissions,
  floorPlanPermissions,
  getViewAccess,
  partsInventoryPermissions,
  serviceOrderPermissions
} from "./viewAccess.js";

const admin = { id: "u1", role: "admin" };
const viewerOf = (...permissions) => ({ id: "u2", role: "viewer", effectivePermissions: permissions });

describe("getViewAccess", () => {
  it("libera todas as visoes para administradores, na ordem da sidebar", () => {
    const access = getViewAccess(admin);
    expect(access.permittedViewIds).toEqual([
      "dashboard",
      "alerts",
      "service-orders",
      "calendar",
      "parts-inventory",
      "inventory"
    ]);
    expect(access.canOpenGeneralSettings).toBe(true);
    expect(access.canManageInventory).toBe(true);
    expect(access.canCustomizeDashboard).toBe(true);
  });

  it("limita as visoes as permissoes do usuario", () => {
    const access = getViewAccess(viewerOf("calendar.view", "service_orders.view"));
    expect(access.permittedViewIds).toEqual(["service-orders", "calendar"]);
    expect(access.canViewDashboard).toBe(false);
    expect(access.canManageInventory).toBe(false);
    expect(access.canOpenGeneralSettings).toBe(false);
  });

  it("abre Avisos por preventivas mas so mostra o item da sidebar para alertas/scripts", () => {
    const preventive = getViewAccess(viewerOf("preventive_plans.view"));
    expect(preventive.permittedViewIds).toEqual(["alerts"]);
    expect(preventive.canViewAlertsModule).toBe(true);
    expect(preventive.showAlertsNav).toBe(false);

    const alerts = getViewAccess(viewerOf("alerts.view"));
    expect(alerts.showAlertsNav).toBe(true);
  });

  it("nao permite nenhuma visao sem permissoes", () => {
    expect(getViewAccess(viewerOf()).permittedViewIds).toEqual([]);
    expect(getViewAccess({}).permittedViewIds).toEqual([]);
  });

  it("habilita configuracoes gerais por qualquer permissao de configuracao", () => {
    expect(getViewAccess(viewerOf("settings.appearance")).canOpenGeneralSettings).toBe(true);
    expect(getViewAccess(viewerOf("settings.system_mode")).canOpenGeneralSettings).toBe(true);
  });
});

describe("mapas de permissoes por modulo", () => {
  it("convertem permissoes granulares em flags nomeadas", () => {
    const user = viewerOf("calendar.create", "floor_plans.update", "parts_inventory.move_stock", "service_orders.print");
    expect(calendarPermissions(user)).toMatchObject({ create: true, update: false, assignTechnician: false });
    expect(floorPlanPermissions(user)).toMatchObject({ update: true, create: false, viewHeatmaps: false });
    expect(partsInventoryPermissions(user)).toMatchObject({ moveStock: true, create: false });
    expect(serviceOrderPermissions(user)).toMatchObject({ print: true, schedule: true, edit: false });
  });

  it("liberam tudo para administradores", () => {
    expect(Object.values(serviceOrderPermissions(admin)).every(Boolean)).toBe(true);
    expect(Object.values(calendarPermissions(admin)).every(Boolean)).toBe(true);
  });
});
