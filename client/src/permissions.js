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
      { id: "inventory.view", label: "Visualizar inventario" },
      { id: "inventory.create_asset", label: "Criar ativos de rede" },
      { id: "inventory.edit_asset", label: "Editar ativos" },
      { id: "inventory.move_assets", label: "Mover maquinas entre segmentos" },
      { id: "inventory.manage_segments", label: "Criar grupos/segmentos" },
      { id: "inventory.view_machine", label: "Acessar ficha da maquina" },
      { id: "inventory.print_qr", label: "Imprimir QR Code" }
    ]
  },
  {
    id: "service_orders",
    label: "Ordens de Servico",
    permissions: [
      { id: "service_orders.view", label: "Visualizar Ordens de Servico" },
      { id: "service_orders.view_all", label: "Visualizar OS de todos os setores" },
      { id: "service_orders.create", label: "Criar Ordem de Servico" },
      { id: "service_orders.edit", label: "Editar Ordem de Servico" },
      { id: "service_orders.change_sector", label: "Alterar setor da OS" },
      { id: "service_orders.assign", label: "Assumir/atribuir tecnico" },
      { id: "service_orders.change_status", label: "Alterar status" },
      { id: "service_orders.close", label: "Finalizar Ordem de Servico" },
      { id: "service_orders.attendance", label: "Registrar atendimento" },
      { id: "service_orders.parts", label: "Registrar pecas trocadas" },
      { id: "service_orders.print", label: "Imprimir Ordem de Servico" },
      { id: "service_orders.settings", label: "Acessar configuracoes da OS" }
    ]
  },
  {
    id: "settings",
    label: "Configuracoes",
    permissions: [
      { id: "settings.general", label: "Acessar configuracoes gerais" },
      { id: "settings.appearance", label: "Alterar aparencia/usabilidade" },
      { id: "settings.system_mode", label: "Alterar modo do sistema" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    permissions: [
      { id: "admin.full", label: "Acesso total administrativo" },
      { id: "admin.users", label: "Administrar usuarios" },
      { id: "admin.sectors", label: "Administrar setores" },
      { id: "admin.permissions", label: "Alterar permissoes" }
    ]
  }
];

export const allPermissionIds = permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.id));

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
    "inventory.print_qr",
    "service_orders.view",
    "service_orders.create",
    "service_orders.edit",
    "service_orders.assign",
    "service_orders.change_status",
    "service_orders.close",
    "service_orders.attendance",
    "service_orders.parts",
    "service_orders.print",
    "service_orders.settings",
    "settings.general",
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

  return [...new Set((Array.isArray(source) ? source : []).filter((permission) => allPermissionIds.includes(permission)))];
}

export function getEffectivePermissions(user = {}) {
  if (user.role === "admin" || user.isAdmin) return allPermissionIds;
  if (Array.isArray(user.effectivePermissions) && user.effectivePermissions.length) {
    return normalizePermissions(user.effectivePermissions);
  }

  return normalizePermissions([
    ...(roleDefaultPermissions[user.role] || roleDefaultPermissions.viewer),
    ...(user.sectorPermissions || []),
    ...(user.permissions || [])
  ]);
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (user?.role === "admin" || user?.isAdmin) return true;
  return getEffectivePermissions(user).includes(permission);
}
