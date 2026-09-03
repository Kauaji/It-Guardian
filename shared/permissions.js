export const permissionGroups = [
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [
      { id: "dashboard.view", label: "Visualizar dashboard" },
      { id: "dashboard.customize", label: "Personalizar widgets do dashboard" }
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
    id: "parts_inventory",
    label: "Inventário de Peças",
    permissions: [
      { id: "parts_inventory.view", label: "Visualizar estoque de peças" },
      { id: "parts_inventory.create", label: "Cadastrar peças" },
      { id: "parts_inventory.update", label: "Editar peças" },
      { id: "parts_inventory.move_stock", label: "Movimentar e consumir estoque" },
      { id: "parts_inventory.assign_assets", label: "Vincular peças a ativos e OS" }
    ]
  },
  {
    id: "floor_plans",
    label: "Plantas e Infraestrutura",
    permissions: [
      { id: "floor_plans.view", label: "Visualizar plantas" },
      { id: "floor_plans.create", label: "Criar plantas" },
      { id: "floor_plans.update", label: "Editar plantas" },
      { id: "floor_plans.delete", label: "Excluir plantas" },
      { id: "floor_plans.link_inventory", label: "Vincular ativos do inventario" }
    ]
  },
  {
    id: "network_topology",
    label: "Mapa de Rede (Inventário)",
    permissions: [
      { id: "inventory.topology.view", label: "Visualizar mapa de rede" },
      { id: "inventory.topology.manage", label: "Gerenciar mapas e ativos" },
      { id: "inventory.topology.link_assets", label: "Conectar itens no mapa" }
    ]
  },
  {
    id: "calendar",
    label: "Agenda Técnica",
    permissions: [
      { id: "calendar.view", label: "Visualizar agenda" },
      { id: "calendar.create", label: "Criar agendamentos" },
      { id: "calendar.update", label: "Editar agendamentos" },
      { id: "calendar.cancel", label: "Cancelar agendamentos" },
      { id: "calendar.delete", label: "Excluir agendamentos" },
      { id: "calendar.assign_technician", label: "Atribuir técnicos" },
      { id: "calendar.view_all_technicians", label: "Visualizar agenda de todos os técnicos" }
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
      { id: "service_orders.settings", label: "Acessar configurações da OS" },
      { id: "service_orders.create_from_alert", label: "Criar OS a partir de aviso" },
      { id: "service_orders.reopen", label: "Reabrir Ordem de Serviço finalizada" },
      { id: "service_orders.manage_checklists", label: "Gerenciar templates de checklist técnico" },
      { id: "service_orders.run_scripts", label: "Executar scripts de manutenção na OS" }
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
      { id: "alerts.manage_suggestions", label: "Gerenciar sugestões de OS" }
    ]
  },
  {
    id: "scripts",
    label: "Scripts de manutenção",
    permissions: [
      { id: "scripts.view", label: "Visualizar scripts de manutenção" },
      { id: "scripts.manage", label: "Cadastrar e editar scripts de manutenção" },
      { id: "scripts.register_simulation", label: "Registrar simulação de script" },
      { id: "scripts.use_from_alert", label: "Usar script em sugestão de OS" },
      { id: "scripts.approve_high_risk", label: "Aprovar execução de scripts de risco alto ou crítico" },
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
      { id: "preventive_plans.prepare", label: "Preparar simulação preventiva" },
      { id: "preventive_plans.create_service_order", label: "Criar OS preventiva a partir do plano" }
    ]
  },
  {
    id: "preventive_automation",
    label: "Automação Preventiva",
    permissions: [
      { id: "preventive_automation.view", label: "Visualizar automações preventivas" },
      { id: "preventive_automation.create", label: "Criar automações preventivas" },
      { id: "preventive_automation.update", label: "Editar automações preventivas" },
      { id: "preventive_automation.disable", label: "Desativar automações preventivas" },
      { id: "preventive_automation.delete", label: "Excluir planos de automação" },
      { id: "preventive_automation.remove_asset", label: "Remover máquinas de uma automação" },
      { id: "preventive_automation.manage_asset_override", label: "Gerenciar recorrência por máquina" },
      { id: "preventive_automation.run_prepare", label: "Preparar rotina preventiva agendada" }
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
    id: "remote_assistance",
    label: "Assistencia remota",
    permissions: [
      { id: "remote_assistance.view", label: "Visualizar assistencia remota" },
      { id: "remote_assistance.chat", label: "Enviar mensagens no chat da assistencia remota" },
      { id: "remote_assistance.start", label: "Iniciar assistencia remota" },
      { id: "remote_assistance.control", label: "Controlar maquina remotamente" },
      { id: "remote_assistance.end", label: "Encerrar assistencia remota" },
      { id: "remote_assistance.manage", label: "Gerenciar assistencias remotas" },
      { id: "remote_assistance.privacy_mode", label: "Solicitar modo de privacidade" },
      { id: "remote_assistance.admin_actions", label: "Executar acoes administrativas remotas" },
      { id: "security.reauthenticate", label: "Reautenticar para acoes sensiveis" }
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
    "dashboard.customize",
    "inventory.view",
    "inventory.create_asset",
    "inventory.edit_asset",
    "inventory.move_assets",
    "inventory.manage_segments",
    "inventory.view_machine",
    "inventory.print_qrcode",
    "parts_inventory.view",
    "parts_inventory.create",
    "parts_inventory.update",
    "parts_inventory.move_stock",
    "parts_inventory.assign_assets",
    "floor_plans.view",
    "floor_plans.create",
    "floor_plans.update",
    "floor_plans.delete",
    "floor_plans.link_inventory",
    "inventory.topology.view",
    "inventory.topology.manage",
    "inventory.topology.link_assets",
    "calendar.view",
    "calendar.create",
    "calendar.update",
    "calendar.cancel",
    "calendar.assign_technician",
    "calendar.view_all_technicians",
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
    "service_orders.create_from_alert",
    "service_orders.reopen",
    "service_orders.manage_checklists",
    "service_orders.run_scripts",
    "alerts.view",
    "alerts.configure",
    "alerts.comment",
    "alerts.silence",
    "alerts.manage_suggestions",
    "scripts.view",
    "scripts.register_simulation",
    "scripts.use_from_alert",
    "script_logs.view",
    "script_logs.resolve",
    "script_validations.manage",
    "preventive_plans.view",
    "preventive_plans.create",
    "preventive_plans.prepare",
    "preventive_plans.create_service_order",
    "preventive_automation.view",
    "preventive_automation.create",
    "preventive_automation.update",
    "preventive_automation.disable",
    "preventive_automation.delete",
    "preventive_automation.remove_asset",
    "preventive_automation.manage_asset_override",
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
  if (Array.isArray(user.effectivePermissions) && user.effectivePermissions.length) {
    return normalizePermissions(user.effectivePermissions).filter((permission) => !permission.startsWith("admin."));
  }

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
