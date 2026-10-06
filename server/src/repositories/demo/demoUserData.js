export const demoUsers = [
  {
    id: "seed-admin",
    name: "Admin Sistema",
    email: "admin@itguardian.local",
    role: "admin",
    sectorId: "sector-administracao",
    jobTitle: "Administrador principal",
    isAdmin: true,
    permissions: ["admin.full"]
  },
  {
    id: "seed-admin-marina",
    name: "Marina Duarte",
    email: "marina.duarte@itguardian.local",
    role: "admin",
    sectorId: "sector-administracao",
    jobTitle: "Administradora auxiliar",
    isAdmin: true,
    permissions: ["admin.full"]
  },
  {
    id: "seed-user-rafael",
    name: "Rafael Nunes",
    email: "rafael.nunes@itguardian.local",
    role: "viewer",
    sectorId: "sector-support-n1",
    jobTitle: "Tecnico N1",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-user-felipe",
    name: "Felipe Castro",
    email: "felipe.castro@itguardian.local",
    role: "viewer",
    sectorId: "sector-suporte-n2",
    jobTitle: "Tecnico avancado",
    isAdmin: false,
    permissions: ["service_orders.edit", "service_orders.parts"]
  },
  {
    id: "seed-user-bruno",
    name: "Bruno Almeida",
    email: "bruno.almeida@itguardian.local",
    role: "viewer",
    sectorId: "sector-infra",
    jobTitle: "Tecnico de infraestrutura",
    isAdmin: false,
    permissions: ["inventory.move_assets"]
  },
  {
    id: "seed-user-camila",
    name: "Camila Rocha",
    email: "camila.rocha@itguardian.local",
    role: "viewer",
    sectorId: "sector-redes",
    jobTitle: "Analista de redes",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-user-patricia",
    name: "Patricia Lima",
    email: "patricia.lima@itguardian.local",
    role: "viewer",
    sectorId: "sector-financeiro",
    jobTitle: "Usuario comum",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-user-andre",
    name: "Andre Torres",
    email: "andre.torres@itguardian.local",
    role: "viewer",
    sectorId: "sector-diretoria",
    jobTitle: "Gestor",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-user-lucas",
    name: "Lucas Pereira",
    email: "lucas.pereira@itguardian.local",
    role: "viewer",
    sectorId: "sector-geral",
    jobTitle: "Usuario novo",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-demo-tecnico-n1",
    name: "Tecnico N1 Demo",
    email: "tecnico.n1@itguardian.local",
    role: "viewer",
    sectorId: "sector-support-n1",
    jobTitle: "Tecnico N1",
    isAdmin: false,
    permissions: []
  },
  {
    id: "seed-demo-tecnico-n2",
    name: "Tecnico N2 Demo",
    email: "tecnico.n2@itguardian.local",
    role: "viewer",
    sectorId: "sector-suporte-n2",
    jobTitle: "Tecnico N2",
    isAdmin: false,
    permissions: ["service_orders.edit", "service_orders.parts"]
  },
  {
    id: "seed-demo-usuario-comum",
    name: "Usuario Comum Demo",
    email: "usuario.comum@itguardian.local",
    role: "viewer",
    sectorId: "sector-geral",
    jobTitle: "Solicitante",
    isAdmin: false,
    permissions: ["service_orders.view", "service_orders.create"]
  },
  {
    id: "seed-demo-sem-permissao",
    name: "Sem Permissao Demo",
    email: "sem.permissao@itguardian.local",
    role: "viewer",
    sectorId: "sector-geral",
    jobTitle: "Usuario sem permissao",
    isAdmin: false,
    permissions: []
  }
];
