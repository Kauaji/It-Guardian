import { vi } from "vitest";

// Utilitarios dos testes do dominio Ordens de Servico: mock da API (barril ../../api.js),
// builders de OS/ativo e stubs dos modulos pesados (tabs, assistencia remota, configuracoes).

export const API_NAMES = [
  "fetchServiceOrderSettings",
  "updateServiceOrderSettings",
  "fetchSectors",
  "fetchTechnicians",
  "fetchClients",
  "fetchProducts",
  "fetchServices",
  "fetchDevice",
  "fetchMaintenanceScriptRecommendations",
  "fetchServiceOrderScriptActivity",
  "registerMaintenanceScriptSimulation",
  "useServiceOrderScript"
];

export function createApiMock() {
  return Object.fromEntries(API_NAMES.map((name) => [name, vi.fn()]));
}

export const NOW = new Date("2026-08-15T12:00:00.000Z");

export const technicians = [
  { id: "t1", name: "Ana Técnica", specialty: "Redes" },
  { id: "t2", name: "Bruno Silva" },
  { id: "t3", name: "Inativo", active: false }
];

export const clients = [
  { id: "c1", tradeName: "Acme", legalName: "Acme SA" },
  { id: "c2", legalName: "Beta Ltda" },
  { id: "c3" },
  { id: "c4", tradeName: "Off", active: false }
];

export const sectors = [
  { id: "sector-ti", name: "TI" },
  { id: "sector-off", name: "Fora", active: false }
];

export const products = [
  { id: "p1", name: "Memória DDR4", category: "Memória", brand: "Kingston", model: "8GB", unitPrice: 250.5 },
  { id: "p2", name: "SSD 480", category: "Armazenamento", brand: "WD", unit_price: "300,00" },
  { id: "p3", name: "Fonte", category: "Energia", price: 120 },
  { id: "p4", name: "Cabo", active: false }
];

export const services = [
  { id: "s1", name: "Formatação", category: "Software", defaultValue: 150 },
  { id: "s2", name: "Troca de peça", category: "Hardware" },
  { id: "s3", name: "Inativo", active: false }
];

export const statuses = [
  { id: "open", name: "Aberta", color: "#2563eb", order: 0, isInitial: true, isFinal: false },
  { id: "in_progress", name: "Em atendimento", color: "#d97706", order: 1, isInitial: false, isFinal: false },
  { id: "closed", name: "Finalizada", color: "#16a34a", order: 2, isInitial: false, isFinal: true }
];

export function makeOrder(overrides = {}) {
  return {
    id: "os-1",
    number: "OS-0001",
    title: "Computador não liga",
    description: "O computador do financeiro não liga.",
    status: "open",
    priority: "high",
    priorityLabel: "Alta",
    category: "Desktop",
    requesterName: "Maria",
    assignedTechnicianName: "Ana Técnica",
    assignedTechnicianNames: ["Ana Técnica"],
    environmentId: "c1",
    environmentName: "Acme",
    sectorId: "sector-ti",
    sectorName: "TI",
    assetId: "dev-1",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-11T10:00:00.000Z",
    closedAt: null,
    createdBy: "u1",
    sla: { status: "on_track" },
    history: [],
    ...overrides
  };
}

export function makeDevice(overrides = {}) {
  return {
    id: "dev-1",
    name: "PC-FIN-01",
    hostname: "pc-fin-01",
    ip: "10.0.0.10",
    assetType: "desktop",
    statusLabel: "Online",
    tabId: "tab-1",
    segmentId: "seg-1",
    ...overrides
  };
}

export function wireApi(api, overrides = {}) {
  const values = {
    settings: {},
    sectors,
    technicians,
    clients,
    products,
    services,
    device: null,
    ...overrides
  };
  api.fetchServiceOrderSettings.mockResolvedValue({ settings: values.settings });
  api.updateServiceOrderSettings.mockImplementation(async (_token, settings) => ({ settings }));
  api.fetchSectors.mockResolvedValue({ sectors: values.sectors });
  api.fetchTechnicians.mockResolvedValue({ technicians: values.technicians });
  api.fetchClients.mockResolvedValue({ clients: values.clients });
  api.fetchProducts.mockResolvedValue({ products: values.products });
  api.fetchServices.mockResolvedValue({ services: values.services });
  api.fetchDevice.mockResolvedValue({ device: values.device });
  api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [], others: [] });
  api.fetchServiceOrderScriptActivity.mockResolvedValue({ activity: [] });
  api.registerMaintenanceScriptSimulation.mockResolvedValue({});
  api.useServiceOrderScript.mockResolvedValue({});
}

function serializeProps(props) {
  return JSON.stringify(props, (_key, value) => (typeof value === "function" ? "[fn]" : value));
}

/** Modulo falso cujo componente padrao so expoe as props recebidas (data-props). */
export function stubModule(testId) {
  function Stub(props) {
    return <div data-testid={testId} data-props={serializeProps(props)} />;
  }
  return { default: Stub };
}

export function stubProps(testId) {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  return element ? JSON.parse(element.getAttribute("data-props")) : null;
}

/** DataTransfer minimo para eventos de arrastar e soltar. */
export function makeDataTransfer() {
  const store = {};
  return {
    store,
    effectAllowed: "",
    dropEffect: "",
    setData: (type, value) => {
      store[type] = value;
    },
    getData: (type) => store[type] || ""
  };
}

export const inventoryTabs = [
  { id: "tab-1", name: "Matriz" },
  { id: "tab-2", name: "" }
];

export const segments = [
  { id: "seg-1", name: "Financeiro", tabId: "tab-1", groupId: "g1" },
  { id: "seg-2", name: "Recepção", tabId: "tab-1" },
  { id: "seg-3", name: "Padrão", tabId: "tab-1", isDefault: true },
  { id: "seg-4", name: "Outro", tabId: "tab-2", group: { id: "g2", name: "Filial" } }
];

export const groups = [{ id: "g1", name: "Andar 1" }];

/** Propriedades padrao do modal de detalhes, com callbacks espionados. */
export function makeDetailsProps(overrides = {}) {
  return {
    serviceOrder: makeOrder(),
    devices: [makeDevice()],
    segments,
    groups,
    tabs: inventoryTabs,
    token: "tok",
    user: { id: "u1", name: "Ana" },
    notify: vi.fn(),
    systemMode: "local",
    statuses,
    sectors,
    saving: false,
    onClose: vi.fn(),
    onUpdate: vi.fn().mockResolvedValue(true),
    onStatusChange: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(true),
    onSelectBackup: vi.fn(),
    onReleaseBackup: vi.fn(),
    onReopen: vi.fn().mockResolvedValue(true),
    onOpenCalendar: vi.fn(),
    permissions: {},
    canChangeSector: false,
    remoteScriptExecutionEnabled: false,
    ...overrides
  };
}
