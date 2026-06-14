export const permissionGroups = [
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [
      { id: "dashboard.view", label: "Visualizar dashboard" }
    ]
  },
  {
    id: "inventory",
    label: "InventÃ¡rio",
    permissions: [
      { id: "inventory.view", label: "Visualizar inventÃ¡rio" },
      { id: "inventory.create_asset", label: "Criar ativos de rede" },
      { id: "inventory.edit_asset", label: "Editar ativos" },
      { id: "inventory.move_assets", label: "Mover mÃ¡quinas entre segmentos" },
      { id: "inventory.manage_segments", label: "Criar grupos/segmentos" },
      { id: "inventory.view_machine", label: "Acessar ficha da mÃ¡quina" },
      { id: "inventory.print_qrcode", label: "Imprimir QR Code" }
    ]
  },
  {
    id: "service_orders",
    label: "Ordens de ServiÃ§o",
    permissions: [
      { id: "service_orders.view", label: "Visualizar Ordens de ServiÃ§o" },
      { id: "service_orders.view_all", label: "Visualizar OS de todos os setores" },
      { id: "service_orders.create", label: "Criar Ordem de ServiÃ§o" },
      { id: "service_orders.edit", label: "Editar Ordem de ServiÃ§o" },
      { id: "service_orders.change_sector", label: "Alterar setor da OS" },
      { id: "service_orders.assign", label: "Assumir/atribuir tÃ©cnico" },
      { id: "service_orders.change_status", label: "Alterar status" },
      { id: "service_orders.finish", label: "Finalizar Ordem de ServiÃ§o" },
      { id: "service_orders.attendance", label: "Registrar atendimento" },
      { id: "service_orders.parts", label: "Registrar peÃ§as trocadas" },
      { id: "service_orders.print", label: "Imprimir Ordem de ServiÃ§o" },
      { id: "service_orders.settings", label: "Acessar configuraÃ§Ãµes da OS" }
    ]
  },
  {
    id: "alerts",
    label: "Avisos",
    permissions: [
      { id: "alerts.view", label: "Visualizar avisos" },
      { id: "alerts.configure", label: "Configurar regras de aviso" },
      { id: "alerts.manage_suggestions", label: "Gerenciar sugestÃƒÂµes de OS" },
      { id: "service_orders.create_from_alert", label: "Criar OS a partir de aviso" }
    ]
  },
  {
    id: "scripts",
    label: "Scripts de manutenÃ§Ã£o",
    permissions: [
      { id: "scripts.view", label: "Visualizar scripts de manutenÃ§Ã£o" },
      { id: "scripts.manage", label: "Cadastrar e editar scripts de manutenÃ§Ã£o" },
      { id: "scripts.register_simulation", label: "Registrar simulaÃ§Ã£o de script" },
      { id: "scripts.use_from_alert", label: "Usar script em sugestão de OS" },
      { id: "script_logs.view", label: "Visualizar logs de scripts" },
      { id: "script_logs.resolve", label: "Resolver logs de scripts" },
      { id: "script_validations.manage", label: "Gerenciar validações de scripts" }
    ]
  },
  {
    id: "preventive_plans",
    label: "Preventivas",
    permissions: [
      { id: "preventive_plans.view", label: "Visualizar planos preventivos" },
      { id: "preventive_plans.create", label: "Criar planos preventivos" },
      { id: "preventive_plans.prepare", label: "Preparar simulaÃ§Ã£o preventiva" }
    ]
  },
  {
    id: "preventive_automation",
    label: "AutomaÃ§Ã£o Preventiva",
    permissions: [
      { id: "preventive_automation.view", label: "Visualizar automaÃ§Ãµes preventivas" },
      { id: "preventive_automation.create", label: "Criar automaÃ§Ãµes preventivas" },
      { id: "preventive_automation.update", label: "Editar automaÃ§Ãµes preventivas" },
      { id: "preventive_automation.disable", label: "Desativar automaÃ§Ãµes preventivas" },
      { id: "preventive_automation.run_prepare", label: "Preparar rotina preventiva agendada" }
    ]
  },
  {
    id: "settings",
    label: "ConfiguraÃ§Ãµes",
    permissions: [
      { id: "settings.view", label: "Acessar configuraÃ§Ãµes gerais" },
      { id: "settings.appearance", label: "Alterar aparÃªncia/usabilidade" },
      { id: "settings.system_mode", label: "Alterar modo do sistema" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    permissions: [
      { id: "admin.full", label: "Acesso total administrativo" },
      { id: "admin.users", label: "Administrar usuÃ¡rios" },
      { id: "admin.sectors", label: "Administrar setores" },
      { id: "admin.permissions", label: "Alterar permissÃµes" }
    ]
  }
];

export const allPermissionIds = permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.id));
export const legacyPermissionAliases = {
  "inventory.print_qr": "inventory.print_qrcode",
  "service_orders.close": "service_orders.finish",
  "settings.general": "settings.view"
};
const acceptedPermissionIds = new Set([...allPermissionIds, ...Object.keys(legacyPermissionAliases)]);

function canonicalPermissionId(permission) {
  return legacyPermissionAliases[permission] || permission;
}

const roleDefaultPermissions = {
  admin: allPermissionIds,
  operator: [
    "dashboard.view",
    "inventory.view",
    "inventory.create_asset",
    "inventory.edit_asset",
    "inventory.move_assets",
    "inventory.manage_segments",
    "inventory.view_machine",
    "inventory.print_qrcode",
    "service_orders.view",
    "service_orders.create",
    "service_orders.edit",
    "service_orders.assign",
    "service_orders.change_status",
    "service_orders.finish",
    "service_orders.attendance",
    "service_orders.parts",
    "service_orders.print",
    "service_orders.settings",
    "alerts.view",
    "alerts.configure",
    "alerts.manage_suggestions",
    "service_orders.create_from_alert",
    "scripts.view",
    "scripts.register_simulation",
    "scripts.use_from_alert",
    "script_logs.view",
    "script_logs.resolve",
    "script_validations.manage",
    "preventive_plans.view",
    "preventive_plans.create",
    "preventive_plans.prepare",
    "preventive_automation.view",
    "preventive_automation.create",
    "preventive_automation.update",
    "preventive_automation.disable",
    "preventive_automation.run_prepare",
    "settings.view",
    "settings.appearance"
  ],
  viewer: []
};

export function normalizePermissions(value = []) {
  let source = value;

  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      source = [];
    }
  }

  return [
    ...new Set(
      (Array.isArray(source) ? source : [])
        .map((permission) => canonicalPermissionId(permission))
        .filter((permission) => acceptedPermissionIds.has(permission))
    )
  ];
}

export function getEffectivePermissions(user = {}) {
  if (user.active === false) return [];
  if (user.role === "admin" || user.isAdmin) return allPermissionIds;
  if (Array.isArray(user.effectivePermissions) && user.effectivePermissions.length) {
    return normalizePermissions(user.effectivePermissions).filter((permission) => !permission.startsWith("admin."));
  }

  return normalizePermissions([
    ...(roleDefaultPermissions[user.role] || roleDefaultPermissions.viewer),
    ...(user.sectorPermissions || []),
    ...(user.permissions || [])
  ]).filter((permission) => !permission.startsWith("admin."));
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (user?.role === "admin" || user?.isAdmin) return true;
  const requested = canonicalPermissionId(permission);
  if (requested.startsWith("admin.")) return false;
  return getEffectivePermissions(user).includes(requested);
}
