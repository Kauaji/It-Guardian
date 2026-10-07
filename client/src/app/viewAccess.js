import { hasPermission } from "../permissions.js";

// Reune, num unico lugar, quais visoes e acoes de alto nivel o usuario pode
// usar. As regras sao as mesmas que estavam espalhadas no antigo Dashboard.
export function getViewAccess(user) {
  const can = (permissionId) => hasPermission(user, permissionId);

  const canViewDashboard = can("dashboard.view");
  const canViewAlerts = can("alerts.view");
  const canViewScripts = can("scripts.view");
  const canViewPreventivePlans = can("preventive_plans.view");
  const canViewPreventiveAutomation = can("preventive_automation.view");
  const canViewInventory = can("inventory.view");
  const canViewServiceOrders = can("service_orders.view");
  const canViewCalendar = can("calendar.view");
  const canViewPartsInventory = can("parts_inventory.view");

  // A visao de Avisos reune alertas, scripts, preventivas e automacoes: abre
  // se qualquer uma delas for permitida, mas o item da sidebar so aparece
  // para alertas/scripts (comportamento original preservado).
  const canViewAlertsModule = canViewAlerts || canViewScripts || canViewPreventivePlans || canViewPreventiveAutomation;

  const permittedViewIds = [];
  if (canViewDashboard) permittedViewIds.push("dashboard");
  if (canViewAlertsModule) permittedViewIds.push("alerts");
  if (canViewServiceOrders) permittedViewIds.push("service-orders");
  if (canViewCalendar) permittedViewIds.push("calendar");
  if (canViewPartsInventory) permittedViewIds.push("parts-inventory");
  if (canViewInventory) permittedViewIds.push("inventory");

  return {
    canCustomizeDashboard: can("dashboard.customize"),
    canManageInventory:
      can("inventory.create_asset") || can("inventory.edit_asset") || can("inventory.move_assets") || can("inventory.manage_segments"),
    canOpenGeneralSettings: can("settings.view") || can("settings.appearance") || can("settings.system_mode") || can("admin.full"),
    canViewAlerts,
    canViewAlertsModule,
    canViewCalendar,
    canViewDashboard,
    canViewFloorPlans: can("floor_plans.view"),
    canViewInventory,
    canViewMachine: can("inventory.view_machine"),
    canViewPartsInventory,
    canViewPreventiveAutomation,
    canViewPreventivePlans,
    canViewScripts,
    canViewServiceOrders,
    canViewTopology: can("inventory.topology.view"),
    permittedViewIds,
    showAlertsNav: canViewAlerts || canViewScripts
  };
}

// Mapeia as permissoes granulares que cada visao repassa aos seus modulos.
function pick(user, mapping) {
  return Object.fromEntries(Object.entries(mapping).map(([key, permissionId]) => [key, hasPermission(user, permissionId)]));
}

export function floorPlanPermissions(user) {
  return pick(user, {
    create: "floor_plans.create",
    update: "floor_plans.update",
    delete: "floor_plans.delete",
    linkInventory: "floor_plans.link_inventory",
    uploadBackground: "floor_plans.upload_background",
    viewHeatmaps: "floor_plans.view_heatmaps"
  });
}

export function calendarPermissions(user) {
  return pick(user, {
    create: "calendar.create",
    update: "calendar.update",
    cancel: "calendar.cancel",
    delete: "calendar.delete",
    assignTechnician: "calendar.assign_technician",
    viewAllTechnicians: "calendar.view_all_technicians"
  });
}

export function partsInventoryPermissions(user) {
  return pick(user, {
    create: "parts_inventory.create",
    update: "parts_inventory.update",
    moveStock: "parts_inventory.move_stock",
    assignAssets: "parts_inventory.assign_assets",
    manageCategories: "parts_inventory.manage_categories",
    importInvoice: "parts_inventory.import_invoice",
    reconcileHardware: "parts_inventory.reconcile_hardware"
  });
}

export function serviceOrderPermissions(user) {
  return pick(user, {
    create: "service_orders.create",
    edit: "service_orders.edit",
    viewAll: "service_orders.view_all",
    changeSector: "service_orders.change_sector",
    changeStatus: "service_orders.change_status",
    finish: "service_orders.finish",
    attendance: "service_orders.attendance",
    parts: "service_orders.parts",
    print: "service_orders.print",
    settings: "service_orders.settings",
    reopen: "service_orders.reopen",
    manageChecklists: "service_orders.manage_checklists",
    runScripts: "service_orders.run_scripts",
    schedule: "calendar.create",
    registerSimulation: "scripts.register_simulation"
  });
}
