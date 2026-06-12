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
    label: "Inventário",
    permissions: [
      { id: "inventory.view", label: "Visualizar inventário" },
      { id: "inventory.create_asset", label: "Criar ativos de rede" },
      { id: "inventory.edit_asset", label: "Editar ativos" },
      { id: "inventory.move_assets", label: "Mover máquinas entre segmentos" },
      { id: "inventory.manage_segments", label: "Criar grupos e segmentos" },
      { id: "inventory.view_machine", label: "Acessar ficha da máquina" },
      { id: "inventory.print_qrcode", label: "Imprimir QR Code" }
    ]
  },
  {
    id: "service_orders",
    label: "Ordens de Serviço",
    permissions: [
      { id: "service_orders.view", label: "Visualizar Ordens de Serviço" },
      { id: "service_orders.view_all", label: "Visualizar OS de todos os setores" },
      { id: "service_orders.create", label: "Criar Ordem de Serviço" },
      { id: "service_orders.edit", label: "Editar Ordem de Serviço" },
      { id: "service_orders.change_sector", label: "Alterar setor da OS" },
      { id: "service_orders.assign", label: "Assumir ou atribuir técnico" },
      { id: "service_orders.change_status", label: "Alterar status" },
      { id: "service_orders.finish", label: "Finalizar Ordem de Serviço" },
      { id: "service_orders.attendance", label: "Registrar atendimento" },
      { id: "service_orders.parts", label: "Registrar peças trocadas" },
      { id: "service_orders.print", label: "Imprimir Ordem de Serviço" },
      { id: "service_orders.settings", label: "Acessar configurações da OS" }
    ]
  },
  {
    id: "alerts",
    label: "Avisos",
    permissions: [
      { id: "alerts.view", label: "Visualizar avisos" },
      { id: "alerts.configure", label: "Configurar regras de aviso" },
      { id: "alerts.comment", label: "Comentar avisos" },
      { id: "alerts.silence", label: "Silenciar avisos" },
      { id: "alerts.manage_suggestions", label: "Gerenciar sugestões de OS" },
      { id: "service_orders.create_from_alert", label: "Criar OS a partir de aviso" }
    ]
  },
  {
    id: "scripts",
    label: "Scripts de manutenção",
    permissions: [
      { id: "scripts.view", label: "Visualizar scripts de manutenção" },
      { id: "scripts.manage", label: "Cadastrar e editar scripts de manutenção" },
      { id: "scripts.register_simulation", label: "Registrar simulação de script" }
    ]
  },
  {
    id: "preventive_plans",
    label: "Preventivas",
    permissions: [
      { id: "preventive_plans.view", label: "Visualizar planos preventivos" },
      { id: "preventive_plans.create", label: "Criar planos preventivos" },
      { id: "preventive_plans.prepare", label: "Preparar simulação preventiva" }
    ]
  },
  {
    id: "settings",
    label: "Configurações",
    permissions: [
      { id: "settings.view", label: "Acessar configurações gerais" },
      { id: "settings.appearance", label: "Alterar aparência e usabilidade" },
      { id: "settings.system_mode", label: "Alterar modo do sistema" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    permissions: [
      { id: "admin.full", label: "Acesso total administrativo" },
      { id: "admin.users", label: "Administrar usuários" },
      { id: "admin.sectors", label: "Administrar setores" },
      { id: "admin.permissions", label: "Alterar permissões" }
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

export const roleDefaultPermissions = {
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
    "alerts.comment",
    "alerts.silence",
    "alerts.manage_suggestions",
    "service_orders.create_from_alert",
    "scripts.view",
    "scripts.register_simulation",
    "preventive_plans.view",
    "preventive_plans.create",
    "preventive_plans.prepare",
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

  if (!Array.isArray(source)) source = [];
  return [
    ...new Set(
      source
        .map((permission) => canonicalPermissionId(permission))
        .filter((permission) => acceptedPermissionIds.has(permission))
    )
  ];
}

export function getRolePermissions(role) {
  return roleDefaultPermissions[role] || roleDefaultPermissions.viewer;
}

export function getEffectivePermissions(user = {}) {
  if (user.active === false) return [];
  if (user.role === "admin" || user.isAdmin) return allPermissionIds;

  return normalizePermissions([
    ...getRolePermissions(user.role),
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
