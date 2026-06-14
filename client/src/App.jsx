import { useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  Cpu,
  Database,
  HardDrive,
  Info,
  KeyRound,
  LogOut,
  MemoryStick,
  Monitor,
  Moon,
  Network,
  PanelLeftClose,
  Palette,
  ClipboardList,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  UserPlus,
  WifiOff,
  XCircle
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  acceptServiceOrderSuggestion,
  acknowledgeScriptLog,
  acknowledgeAlert,
  analyzeMaintenanceScript,
  applyScriptLogSuggestedSolution,
  cancelScriptValidation,
  createAlertComment,
  createMaintenanceScript,
  createManualAsset,
  createPreventivePlan,
  createPreventivePlanServiceOrder,
  createPreventiveAutomationPlan,
  createSegment,
  createSegmentGroup as createSegmentGroupApi,
  createMonitoringSocket,
  deleteDevice,
  deleteMaintenanceScript,
  disablePreventiveAutomationPlan,
  deleteServiceOrder,
  deleteSegment,
  deleteSegmentGroup as deleteSegmentGroupApi,
  evaluateAlerts,
  fetchAlertCorrelations,
  fetchAlertHistory,
  fetchAlertRules,
  fetchAlertSettings,
  fetchAlerts,
  fetchDevice,
  fetchDevices,
  fetchMaintenanceScripts,
  fetchPreventiveAutomationPlans,
  fetchPreventivePlans,
  fetchServiceOrders,
  fetchServiceOrderSuggestions,
  fetchSegmentGroups,
  fetchSegments,
  fetchSystemSettings,
  login,
  removeAlertAcknowledgement,
  rejectServiceOrderSuggestion,
  renameSegment,
  register,
  registerMaintenanceScriptSimulation,
  refreshAssetPing,
  preparePreventiveAutomationPlan,
  createServiceOrder,
  addServiceOrderHistory,
  updateServiceOrder,
  updateAlertSettings,
  updateServiceOrderStatus,
  updateDeviceBackup,
  updateSegmentGroup,
  updateDeviceType,
  updateDeviceSegment,
  updateAlertRule,
  updateMaintenanceScript,
  updatePreventiveAutomationPlan,
  updateSystemSettings,
  useSuggestionScript
} from "./api.js";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import AssetDragCompactOverlay from "./components/inventory/AssetDragCompactOverlay.jsx";
import BulkAssetLabelPrint from "./components/inventory/BulkAssetLabelPrint.jsx";
import MaintenanceScriptsPanel from "./components/maintenance/MaintenanceScriptsPanel.jsx";
import InventoryBoard from "./components/inventory/InventoryBoard.jsx";
import InventoryTabFormModal from "./components/inventory/InventoryTabFormModal.jsx";
import ManualAssetForm from "./components/inventory/ManualAssetForm.jsx";
import SegmentDragOverlay from "./components/inventory/SegmentDragOverlay.jsx";
import SegmentFormModal from "./components/inventory/SegmentFormModal.jsx";
import SegmentGroupFormModal from "./components/inventory/SegmentGroupFormModal.jsx";
import SidebarSegmentFilter from "./components/inventory/SidebarSegmentFilter.jsx";
import { useInventoryDragAndDrop } from "./components/inventory/useInventoryDragAndDrop.js";
import ServiceOrdersBoard from "./components/serviceOrders/ServiceOrdersBoard.jsx";
import GeneralSettingsModal, {
  applyStoredGeneralPreferences,
  clearRuntimeAppearancePreferences
} from "./components/settings/GeneralSettingsModal.jsx";
import PublicSupportRequest from "./components/public/PublicSupportRequest.jsx";
import { hasPermission } from "./permissions.js";
import {
  assignSegmentToGroup,
  getSegmentGroupId,
  hasDuplicateSegmentName,
  moveIdInList,
  upsertSegmentList
} from "./components/inventory/inventoryUtils.js";

const tokenKey = "it_guardian_token";
const userKey = "it_guardian_user";
const aliasKey = "it_guardian_machine_aliases";
const observationsKey = "it_guardian_machine_observations";
const themeKey = "it_guardian_theme";
const peripheralRemovalsKey = "it_guardian_removed_peripherals";
const peripheralHistoryKey = "it_guardian_peripheral_history";
const inventoryTabsKey = "it_guardian_inventory_tabs";
const activeInventoryTabKey = "it_guardian_active_inventory_tab";
const inventoryTabMetaKey = "it_guardian_inventory_tab_meta";
const maintenanceRecordsKey = "it_guardian_maintenance_records";
const backupSegmentId = "system-backup";
const backupSegmentName = "Backup";

const defaultInventoryTab = {
  id: "tab-default",
  name: "Novo ambiente",
  color: "#2563eb",
  order: 0
};

const segmentPalette = [
  "#2563eb",
  "#16a34a",
  "#7c3aed",
  "#0891b2",
  "#d97706",
  "#dc2626",
  "#ea580c",
  "#db2777"
];

function pickSegmentColor(segments) {
  const lastColor = segments.filter((segment) => !segment.isDefault).at(-1)?.color;
  const index = Math.max(0, segments.filter((segment) => !segment.isDefault).length);
  const preferred = segmentPalette[index % segmentPalette.length];

  if (preferred !== lastColor) return preferred;
  return segmentPalette[(index + 1) % segmentPalette.length];
}

function pickUnusedPaletteColor(items = []) {
  const usedColors = new Set(
    items
      .map((item) => item?.color?.toLowerCase())
      .filter(Boolean)
  );
  const unusedColor = segmentPalette.find((color) => !usedColors.has(color.toLowerCase()));

  return unusedColor || pickSegmentColor(items);
}

function normalizeMaintenanceName(name = "") {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function isMaintenanceSegmentName(name = "") {
  return normalizeMaintenanceName(name) === "manutencao";
}

function isReservedSegmentName(name = "") {
  const normalizedName = normalizeMaintenanceName(name).replace(/\s+/g, " ");
  return normalizedName === "manutencao" || normalizedName === "nao organizadas";
}

function getNextInventoryTabName(tabs = []) {
  const usedNames = new Set(tabs.map((tab) => tab.name?.trim().toLowerCase()).filter(Boolean));
  if (!usedNames.has("novo ambiente")) return "Novo ambiente";

  let nextNumber = 2;
  while (usedNames.has(`novo ambiente ${nextNumber}`)) {
    nextNumber += 1;
  }
  return `Novo ambiente ${nextNumber}`;
}

function readStoredJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function readSystemMode() {
  return "local";
}

function normalizeInventoryTabs(value) {
  const tabs = Array.isArray(value) && value.length ? value : [defaultInventoryTab];
  const normalized = [];

  for (const [index, tab] of tabs.entries()) {
    const requestedName = tab.name?.trim();
    const name =
      !requestedName || requestedName === "Sem nome"
        ? getNextInventoryTabName(normalized)
        : requestedName;

    normalized.push({
      ...defaultInventoryTab,
      ...tab,
      id: tab.id || `tab-${index}`,
      name,
      color: tab.color || segmentPalette[index % segmentPalette.length],
      order: Number.isFinite(tab.order) ? tab.order : index
    });
  }

  return normalized
    .sort((left, right) => left.order - right.order);
}

function normalizeInventoryTabMeta(value) {
  return {
    groups: value?.groups || {},
    segments: value?.segments || {},
    devices: value?.devices || {}
  };
}

const inventoryDropAnimation = {
  duration: 210,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
};

function keepDragOverlayNearCursor({ activatorEvent, active, activeNodeRect, overlayNodeRect, transform }) {
  const dragType = active?.data?.current?.type;

  if (
    (dragType !== "machine" && dragType !== "segment") ||
    !activatorEvent ||
    !activeNodeRect ||
    !overlayNodeRect
  ) {
    return transform;
  }

  const point = "touches" in activatorEvent
    ? activatorEvent.touches?.[0]
    : activatorEvent;

  if (!point || typeof point.clientX !== "number" || typeof point.clientY !== "number") {
    return transform;
  }

  const initialOffsetX = point.clientX - activeNodeRect.left;
  const initialOffsetY = point.clientY - activeNodeRect.top;
  const cursorGapX = dragType === "segment"
    ? 14
    : Math.min(18, Math.max(12, overlayNodeRect.width * 0.06));
  const desiredOffsetY = dragType === "segment"
    ? Math.min(18, Math.max(10, overlayNodeRect.height * 0.4))
    : Math.min(24, Math.max(14, overlayNodeRect.height * 0.18));

  return {
    ...transform,
    x: transform.x + initialOffsetX + cursorGapX,
    y: transform.y + initialOffsetY - desiredOffsetY
  };
}

function inventoryCollisionDetection(args) {
  const { active, pointerCoordinates, droppableContainers, droppableRects } = args;
  const activeType = active?.data?.current?.type;

  if (activeType === "segment") {
    const groupContainers = droppableContainers.filter(
      (container) =>
        container.data.current?.type === "segment-group-drop" ||
        container.data.current?.type === "sidebar-segment-group-drop"
    );
    return closestCenter({ ...args, droppableContainers: groupContainers });
  }

  const pointerNearSidebar = !pointerCoordinates || pointerCoordinates.x <= 400;
  const segmentContainers = droppableContainers.filter(
    (container) => container.data.current?.type === "segment"
  );
  const sidebarSegmentContainers = pointerNearSidebar
    ? droppableContainers.filter((container) => container.data.current?.type === "sidebar-segment")
    : [];
  const machineContainers = [...segmentContainers, ...sidebarSegmentContainers];

  if (pointerCoordinates) {
    const sidebarCandidates = sidebarSegmentContainers
      .map((container) => {
        const rect = droppableRects.get(container.id);
        if (!rect) return null;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = Math.max(rect.left - pointerCoordinates.x, 0, pointerCoordinates.x - rect.right);
        const dy = Math.max(rect.top - pointerCoordinates.y, 0, pointerCoordinates.y - rect.bottom);
        const edgeDistance = Math.hypot(dx, dy);
        const centerDistance = Math.hypot(pointerCoordinates.x - centerX, pointerCoordinates.y - centerY);
        const insideMagneticZone =
          pointerCoordinates.x >= rect.left - 84 &&
          pointerCoordinates.x <= rect.right + 132 &&
          pointerCoordinates.y >= rect.top - 34 &&
          pointerCoordinates.y <= rect.bottom + 34;

        return insideMagneticZone
          ? {
              id: container.id,
              data: {
                droppableContainer: container,
                value: edgeDistance * 0.72 + centerDistance * 0.28
              }
            }
          : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.data.value - right.data.value);

    if (sidebarCandidates.length) {
      return [sidebarCandidates[0]];
    }

    const segmentCandidates = segmentContainers
      .map((container) => {
        const rect = droppableRects.get(container.id);
        if (!rect) return null;
        const inside =
          pointerCoordinates.x >= rect.left &&
          pointerCoordinates.x <= rect.right &&
          pointerCoordinates.y >= rect.top &&
          pointerCoordinates.y <= rect.bottom;
        if (!inside) return null;

        return {
          id: container.id,
          data: {
            droppableContainer: container,
            value: rect.width * rect.height
          }
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.data.value - right.data.value);

    if (segmentCandidates.length) {
      return [segmentCandidates[0]];
    }
  }

  return closestCenter({ ...args, droppableContainers: machineContainers });
}

function metricClass(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

function statusClass(status) {
  return {
    online: "ok",
    offline: "danger",
    problem: "warning"
  }[status];
}

function formatDate(value) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function isAlertResolved(alert) {
  return alert.status === "resolved" || Boolean(alert.acknowledgement);
}

function applySegmentGroups(segmentList, groups) {
  return segmentList.map((segment) => ({
    ...segment,
    groupId: getSegmentGroupId(segment, groups)
  }));
}

function peripheralKey(peripheral) {
  return peripheral?.id || `${peripheral?.type || "item"}-${peripheral?.brand || ""}-${peripheral?.assetTag || ""}`;
}

function applyInventoryLocalState(devices, removedPeripherals, peripheralHistory, maintenanceRecords = {}) {
  return devices.map((device) => {
    const removed = new Set(removedPeripherals[device.id] || []);
    const peripherals = device.hardware?.peripherals || [];
    const maintenanceRecord = maintenanceRecords[device.id];

    return {
      ...device,
      maintenance: Boolean(maintenanceRecord?.active),
      maintenanceOrigin: maintenanceRecord?.origin || null,
      assetHistory: [...(peripheralHistory[device.id] || []), ...(device.assetHistory || [])],
      hardware: {
        ...device.hardware,
        peripherals: peripherals.filter((peripheral) => !removed.has(peripheralKey(peripheral)))
      }
    };
  });
}

function Toast({ message, tone, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 4200);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return <div className={`toast ${tone}`}>{message}</div>;
}

function AuthScreen({ onAuth, notify }) {
  const useDemoCredentials = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: useDemoCredentials ? "admin@itguardian.local" : "",
    password: useDemoCredentials ? "123456" : ""
  });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const action = mode === "login" ? login : register;
      const data = await action(form);
      localStorage.setItem(tokenKey, data.token);
      localStorage.setItem(userKey, JSON.stringify(data.user));
      onAuth(data);
      notify(mode === "login" ? "Login realizado com sucesso." : "Conta criada com sucesso.", "ok");
    } catch (error) {
      if (error.statusCode === 401) {
        notify("E-mail ou senha invalidos.", "danger");
        return;
      }
      notify(error.message, "danger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <ShieldCheck size={34} />
          <div>
            <h1>IT Guardian</h1>
            <p>Monitoramento integrado de infraestrutura</p>
          </div>
        </div>

        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            <ShieldCheck size={16} />
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            <UserPlus size={16} />
            Cadastro
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Operador NOC"
              />
            </label>
          )}
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="admin@empresa.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="********"
            />
          </label>
          <button className="primary-action" disabled={loading}>
            {loading ? "Entrando..." : mode === "login" ? "Acessar painel" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`summary-card ${tone || ""}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MetricBar({ label, value, icon: Icon }) {
  return (
    <div className="metric-row">
      <div className="metric-label">
        <Icon size={15} />
        <span>{label}</span>
      </div>
      <div className="bar">
        <span className={metricClass(value)} style={{ width: `${value}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

function DeviceTable({ devices, selectedId, onSelect }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Dispositivo</th>
            <th>IP</th>
            <th>Status</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>Disco</th>
            <th>Hardware</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr
              key={device.id}
              className={selectedId === device.id ? "selected" : ""}
              onClick={() => onSelect(device.id)}
            >
              <td>
                <div className="device-name">
                  <Server size={16} />
                  <strong>{device.name}</strong>
                </div>
              </td>
              <td>{device.ip}</td>
              <td>
                <span className={`pill ${statusClass(device.status)}`}>{device.statusLabel}</span>
              </td>
              <td>{device.metrics?.cpu ?? "-" }{device.metrics ? "%" : ""}</td>
              <td>{device.metrics?.ram ?? "-" }{device.metrics ? "%" : ""}</td>
              <td>{device.metrics?.disk ?? "-" }{device.metrics ? "%" : ""}</td>
              <td>{device.hardware?.model || "Sem inventario"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

const defaultPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};

const defaultAutoPriority = {
  enabled: false,
  lowToMediumHours: 24,
  mediumToHighHours: 48,
  highToCriticalHours: 72
};

const defaultAlertOperationalSettings = {
  rejectedAlertSilenceHours: 24,
  recurrenceCounterResetHours: 24,
  preventiveDueDays: 180,
  scriptValidationWindowMinutes: 30
};

function normalizePrioritySettings(settings = {}) {
  return {
    rejectedAlertSilenceHours: Math.max(
      1,
      Number(settings.rejectedAlertSilenceHours || defaultAlertOperationalSettings.rejectedAlertSilenceHours)
    ),
    recurrenceCounterResetHours: Math.max(
      1,
      Number(settings.recurrenceCounterResetHours || defaultAlertOperationalSettings.recurrenceCounterResetHours)
    ),
    preventiveDueDays: Math.max(
      1,
      Number(settings.preventiveDueDays || defaultAlertOperationalSettings.preventiveDueDays)
    ),
    scriptValidationWindowMinutes: Math.min(
      10080,
      Math.max(
        5,
        Number(settings.scriptValidationWindowMinutes || defaultAlertOperationalSettings.scriptValidationWindowMinutes)
      )
    ),
    autoPriority: {
      ...defaultAutoPriority,
      ...(settings.autoPriority || {})
    },
    priorityColors: {
      ...defaultPriorityColors,
      ...(settings.priorityColors || {})
    }
  };
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const suggestionStatusLabels = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Recusada",
  validated: "Validada"
};

const scriptValidationLabels = {
  pending_validation: "Aguardando validação",
  waiting_agent: "Aguardando agente seguro",
  validation_success: "Resolvido após validação",
  validation_failed: "Problema persistente",
  validation_cancelled: "Validação cancelada"
};

function getScriptValidationTooltip(validation = {}) {
  if (!validation?.status) return "";
  const dueText = validation.validationDueAt ? ` Previsão: ${formatDate(validation.validationDueAt)}.` : "";
  if (validation.status === "validation_failed") {
    return "Validação falhou. O problema continua após o período configurado.";
  }
  if (validation.status === "validation_success") {
    return "Problema não voltou no período de validação.";
  }
  if (validation.status === "validation_cancelled") {
    return "Validação cancelada.";
  }
  return `Validação em andamento. O sistema está aguardando para verificar se o problema será resolvido.${dueText}`;
};

const preventiveStatusLabels = {
  prepared: "Preparado",
  simulated: "Registrado",
  completed: "Concluído manualmente",
  failed: "Falha no registro",
  cancelled: "Cancelado"
};

function formatAlertValue(alert) {
  if (alert.value === null || alert.value === undefined) return "Não informado";
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${alert.value}%`;
  if (alert.metric === "temperature") return `${alert.value} °C`;
  if (alert.metric === "availability" || alert.metric === "ping" || alert.metric === "service") {
    return alert.value === 0 ? "Indisponível" : String(alert.value);
  }
  return String(alert.value);
}

function formatSuggestionCode(suggestion, index) {
  const date = new Date(suggestion.createdAt);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `AVISO-${year}-${String(index + 1).padStart(4, "0")}`;
}

function getSuggestionMachineLabel(suggestion) {
  if (suggestion.hostName) return suggestion.hostName;
  if (suggestion.assetName) return suggestion.assetName;
  if (suggestion.assetId) return suggestion.assetId;
  const match = String(suggestion.title || "").match(/\bem\s+([A-Z0-9._-]+)$/i);
  return match?.[1] || "Máquina não vinculada";
}

function formatAlertThreshold(alert) {
  if (alert.threshold === null || alert.threshold === undefined) return "Sem limite";
  if (["ram", "cpu", "disk", "disk_health", "network"].includes(alert.metric)) return `${alert.threshold}%`;
  if (alert.metric === "temperature") return `${alert.threshold} °C`;
  return String(alert.threshold);
}

const alertCategoryByType = {
  ram_high: "Desempenho",
  cpu_high: "Desempenho",
  disk_high: "Armazenamento",
  disk_health_low: "Armazenamento",
  machine_offline: "Disponibilidade",
  network_high: "Segurança",
  temperature_high: "Ambiente físico",
  ping_failure: "Disponibilidade",
  service_unavailable: "Disponibilidade"
};

const alertImpactByType = {
  ram_high: "Lentidão, travamentos e risco de parada do atendimento.",
  cpu_high: "Processamento acima do esperado e degradação de desempenho.",
  disk_high: "Risco de indisponibilidade por falta de espaço.",
  disk_health_low: "Risco de perda de dados ou falha física do disco.",
  machine_offline: "Usuário ou serviço pode estar sem acesso ao equipamento.",
  network_high: "Possível instabilidade de comunicação ou saturação de rede.",
  temperature_high: "Risco físico ao equipamento por superaquecimento.",
  ping_failure: "Instabilidade de comunicação com o equipamento.",
  service_unavailable: "Serviço crítico indisponível para o usuário final."
};

const alertRecommendedActions = {
  ram_high: "Verificar processos em execução, reiniciar serviços pesados e avaliar expansão de memória.",
  cpu_high: "Identificar processo com alto consumo e validar se há tarefa travada.",
  disk_high: "Liberar espaço, mover arquivos temporários e avaliar limpeza preventiva.",
  disk_health_low: "Priorizar backup dos dados e avaliar troca preventiva do disco.",
  machine_offline: "Confirmar energia, rede e disponibilidade do equipamento antes de abrir atendimento.",
  network_high: "Validar tráfego incomum, portas ativas e uso de banda no segmento.",
  temperature_high: "Verificar ventilação, limpeza física e temperatura do ambiente.",
  ping_failure: "Validar cabo, Wi-Fi, switch e estabilidade do endereço IP.",
  service_unavailable: "Verificar serviço, dependências e logs antes de acionar manutenção."
};

const alertProbableCauses = {
  ram_high: "Aplicação pesada, vazamento de memória ou carga acima do normal.",
  cpu_high: "Processo travado, atualização em execução ou uso indevido de recursos.",
  disk_high: "Arquivos temporários, logs acumulados ou armazenamento insuficiente.",
  disk_health_low: "Desgaste do disco, setores instáveis ou falha iminente.",
  machine_offline: "Equipamento desligado, cabo desconectado, queda de rede ou IP indisponível.",
  network_high: "Backup, cópia de arquivos, atualização ou tráfego não esperado.",
  temperature_high: "Poeira, ventilação obstruída ou ambiente quente.",
  ping_failure: "Oscilação de rede, conflito de IP ou equipamento intermitente.",
  service_unavailable: "Serviço parado, dependência indisponível ou erro de configuração."
};

function getAlertCategory(alert) {
  return alertCategoryByType[alert.type] || alertCategoryByType[alert.metric] || "Inventário";
}

function getAlertImpact(alert) {
  return alertImpactByType[alert.type] || alertImpactByType[alert.metric] || "Pode afetar a operação do equipamento ou do setor.";
}

function getAlertRecommendedAction(alert) {
  return alertRecommendedActions[alert.type] || alertRecommendedActions[alert.metric] || "Validar o equipamento e registrar análise técnica.";
}

function getAlertProbableCause(alert) {
  return alertProbableCauses[alert.type] || alertProbableCauses[alert.metric] || "Evidência simulada ainda sem causa específica definida.";
}

function getAlertConfidence(alert) {
  const occurrences = Number(alert.occurrencesCount || 0);
  if (occurrences >= 3 || alert.severity === "critical") return "Alta";
  if (occurrences >= 2) return "Média";
  return "Baixa";
}

function getAlertTrend(alert) {
  const occurrences = Number(alert.occurrencesCount || 0);
  if (alert.status === "resolved") return "Normalizou";
  if (occurrences >= 3) return "Subindo";
  if (occurrences === 2) return "Oscilando";
  return "Estável";
}

function AlertList({ alerts }) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <h2>Avisos ativos</h2>
        <Bell size={18} />
      </div>
      <div className="alert-stack">
        {alerts.map((alert) => (
          <article key={alert.id} className={`alert-item ${alert.severity}`}>
            <AlertTriangle size={18} />
            <div>
              <strong>{alert.title}</strong>
              <span>{alert.hostName} - {formatDate(alert.startedAt)}</span>
              <p>{alert.description}</p>
              {alert.acknowledgement && (
                <small className="inline-resolved">
                  <CheckCircle size={13} />
                  Resolvido
                </small>
              )}
            </div>
          </article>
        ))}
        {!alerts.length && <p className="empty">Nenhum aviso ativo.</p>}
      </div>
    </section>
  );
}

function AlertCenter({
  alerts,
  history,
  suggestions,
  rules,
  scripts,
  devices,
  segments = [],
  segmentGroups = [],
  serviceOrderPriorityColors = defaultPriorityColors,
  serviceOrderPrioritySettings = normalizePrioritySettings(),
  serviceOrders,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  suggestionStatusFilter,
  setSuggestionStatusFilter,
  canViewAlerts,
  canManageSuggestions,
  canConfigureAlerts,
  canConfigurePrioritySettings,
  canViewScripts,
  canManageScripts,
  canRegisterScriptSimulation,
  onEvaluateAlerts,
  onAcceptSuggestion,
  onRejectSuggestion,
  onUpdateRule,
  onSavePrioritySettings,
  onAnalyzeMaintenanceScript,
  onSaveMaintenanceScript,
  onDeactivateMaintenanceScript,
  onRegisterMaintenanceScriptSimulation
}) {
  const visibleAlerts = history.filter((alert) => {
    const severityMatches = severityFilter === "all" || alert.severity === severityFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && alert.status === "active") ||
      (statusFilter === "resolved" && alert.status === "resolved");

    return severityMatches && statusMatches;
  });
  const visibleSuggestions = suggestions.filter((suggestion) => {
    if (suggestionStatusFilter === "all") return suggestion.status === "pending";
    return suggestionStatusFilter === "all" || suggestion.status === suggestionStatusFilter;
  }).sort((left, right) => {
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    const leftWeight =
      (priorityWeight[left.suggestedPriority] || 0) * 100 +
      (left.alertSeverity === "critical" ? 50 : 0) +
      Number(left.occurrencesCount || 1) * 8;
    const rightWeight =
      (priorityWeight[right.suggestedPriority] || 0) * 100 +
      (right.alertSeverity === "critical" ? 50 : 0) +
      Number(right.occurrencesCount || 1) * 8;

    if (rightWeight !== leftWeight) return rightWeight - leftWeight;
    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
  });
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted").length;
  const recurringAlerts = alerts.filter((alert) => (alert.occurrencesCount || 0) >= 3).length;

  return (
    <section className="view-stack">
      {(canViewAlerts || canViewPreventivePlans || canViewPreventiveAutomation) && (
        <>
      <section className="summary-grid compact-summary alerts-summary">
        <SummaryCard icon={Bell} label="Avisos ativos" value={alerts.length} tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Críticos" value={criticalAlerts} tone="danger" />
        <SummaryCard icon={ClipboardList} label="Sugestões pendentes" value={pendingSuggestions} tone="warning" />
        <SummaryCard icon={CheckCircle} label="OS criadas por aviso" value={acceptedSuggestions} tone="ok" />
        <SummaryCard icon={RefreshCw} label="Avisos recorrentes" value={recurringAlerts} tone="info" />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Central de avisos</h2>
            <p>Avisos simulados e sugestões preventivas de Ordens de Serviço.</p>
          </div>
          <Bell size={18} />
        </div>
        <div className="toolbar inline-toolbar">
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">Todas as severidades</option>
            <option value="critical">Crítico</option>
            <option value="warning">Atenção</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos os estados</option>
            <option value="active">Ativos</option>
            <option value="resolved">Resolvidos</option>
          </select>
          {canManageSuggestions && (
            <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
              Avaliar recorrência
            </button>
          )}
        </div>

        <div className="alert-board">
          {visibleAlerts.map((alert) => (
            <article key={alert.id} className={`alert-card ${alert.severity}`}>
              <div>
                <span className={`pill ${alert.status === "resolved" ? "ok" : "warning"}`}>
                  {alert.status === "resolved" ? "Resolvido" : "Ativo"}
                </span>
                <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                  {alert.severity === "critical" ? "Crítico" : "Atenção"}
                </span>
              </div>
              <h3>{alert.title}</h3>
              <p>{alert.description}</p>
              <dl>
                <div>
                  <dt>Máquina</dt>
                  <dd>{alert.hostName}</dd>
                </div>
                <div>
                  <dt>Métrica</dt>
                  <dd>{alert.metric}</dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd>{formatAlertValue(alert)}</dd>
                </div>
                <div>
                  <dt>Limite</dt>
                  <dd>{formatAlertThreshold(alert)}</dd>
                </div>
                <div>
                  <dt>Ocorrências</dt>
                  <dd>{alert.occurrencesCount || 1}</dd>
                </div>
                <div>
                  <dt>Última ocorrência</dt>
                  <dd>{formatDate(alert.lastSeenAt || alert.startedAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!visibleAlerts.length && <p className="empty">Nenhum aviso encontrado para os filtros atuais.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Sugestões de OS</h2>
            <p>Aviso recorrente só vira Ordem de Serviço quando alguém aceita a sugestão.</p>
          </div>
          <ClipboardList size={18} />
        </div>
        <div className="toolbar inline-toolbar">
          <select value={suggestionStatusFilter} onChange={(event) => setSuggestionStatusFilter(event.target.value)}>
            <option value="all">Todas as sugestões</option>
            <option value="pending">Pendentes</option>
            <option value="accepted">Aceitas</option>
            <option value="rejected">Recusadas</option>
          </select>
        </div>
        <div className="alert-board">
          {visibleSuggestions.map((suggestion) => (
            <article key={suggestion.id} className={`alert-card ${suggestion.suggestedPriority === "critical" ? "critical" : "warning"}`}>
              <div>
                <span className={`pill ${suggestion.status === "accepted" ? "ok" : suggestion.status === "rejected" ? "danger" : "warning"}`}>
                  {suggestionStatusLabels[suggestion.status] || suggestion.status}
                </span>
                <span className={`pill ${suggestion.suggestedPriority === "critical" ? "danger" : "warning"}`}>
                  {priorityLabels[suggestion.suggestedPriority] || suggestion.suggestedPriority}
                </span>
              </div>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.description}</p>
              <dl>
                <div>
                  <dt>Máquina</dt>
                  <dd>{suggestion.hostName || suggestion.assetId || "Não vinculada"}</dd>
                </div>
                <div>
                  <dt>Motivo</dt>
                  <dd>{alertTypeLabels[suggestion.alertType] || suggestion.alertType || "Aviso recorrente"}</dd>
                </div>
                <div>
                  <dt>Ocorrências</dt>
                  <dd>{suggestion.occurrencesCount}</dd>
                </div>
                <div>
                  <dt>Criada em</dt>
                  <dd>{formatDate(suggestion.createdAt)}</dd>
                </div>
                {suggestion.createdServiceOrderId && (
                  <div>
                    <dt>OS criada</dt>
                    <dd>{suggestion.createdServiceOrderId}</dd>
                  </div>
                )}
                {suggestion.rejectionReason && (
                  <div>
                    <dt>Motivo da recusa</dt>
                    <dd>{suggestion.rejectionReason}</dd>
                  </div>
                )}
              </dl>
              {canManageSuggestions && suggestion.status === "pending" && (
                <div className="suggestion-actions">
                  <button type="button" className="primary-action compact-action" onClick={() => onAcceptSuggestion(suggestion.id)}>
                    Criar OS
                  </button>
                  <button type="button" className="danger-action compact-action" onClick={() => onRejectSuggestion(suggestion.id)}>
                    Recusar
                  </button>
                </div>
              )}
            </article>
          ))}
          {!visibleSuggestions.length && <p className="empty">Nenhuma sugestão encontrada para os filtros atuais.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Configurações de aviso</h2>
            <p>Limites e recorrência usados para sugerir Ordens de Serviço.</p>
          </div>
          <SettingsIcon size={18} />
        </div>
        <div className="settings-table alert-rules-table">
          <div className="settings-table-head">
            <span>Tipo</span>
            <span>Limite</span>
            <span>Tempo mínimo</span>
            <span>Recorrência</span>
            <span>Janela</span>
            <span>Status</span>
          </div>
          {rules.map((rule) => (
            <div key={rule.id} className="settings-table-row alert-rule-row">
              <span>{alertTypeLabels[rule.type] || rule.type}</span>
              <span>
                <input
                  type="number"
                  min="0"
                  value={rule.threshold ?? ""}
                  disabled={!canConfigureAlerts}
                  onChange={(event) => onUpdateRule(rule.id, { threshold: event.target.value })}
                />
              </span>
              <span>
                <input
                  type="number"
                  min="0"
                  value={rule.durationMinutes}
                  disabled={!canConfigureAlerts}
                  onChange={(event) => onUpdateRule(rule.id, { durationMinutes: event.target.value })}
                />
              </span>
              <span>
                <input
                  type="number"
                  min="1"
                  value={rule.recurrenceCount}
                  disabled={!canConfigureAlerts}
                  onChange={(event) => onUpdateRule(rule.id, { recurrenceCount: event.target.value })}
                />
              </span>
              <span>
                <select
                  value={rule.recurrenceWindow}
                  disabled={!canConfigureAlerts}
                  onChange={(event) => onUpdateRule(rule.id, { recurrenceWindow: event.target.value })}
                >
                  <option value="same_day">Mesmo dia</option>
                  <option value="last_24h">Últimas 24 horas</option>
                  <option value="custom">Período configurável</option>
                </select>
              </span>
              <span>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={!canConfigureAlerts}
                    onChange={(event) => onUpdateRule(rule.id, { enabled: event.target.checked })}
                  />
                  Ativa
                </label>
              </span>
            </div>
          ))}
        </div>
      </section>
        </>
      )}

      {canViewScripts && (
        <MaintenanceScriptsPanel
          scripts={scripts}
          devices={devices}
          serviceOrders={serviceOrders}
          alerts={alerts}
          canManage={canManageScripts}
          canRegisterSimulation={canRegisterScriptSimulation}
          onAnalyze={onAnalyzeMaintenanceScript}
          onSave={onSaveMaintenanceScript}
          onDeactivate={onDeactivateMaintenanceScript}
          onRegisterSimulation={onRegisterMaintenanceScriptSimulation}
        />
      )}
    </section>
  );
}

const preventiveAutomationRecurrenceLabels = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom_days: "Personalizada em dias"
};

const preventiveAutomationScopeLabels = {
  all: "Todas as máquinas",
  asset: "Máquina",
  segment: "Segmento",
  group: "Grupo"
};

function getDefaultRecurrenceInterval(type) {
  if (type === "daily") return 1;
  if (type === "weekly") return 7;
  if (type === "biweekly") return 15;
  return 30;
}

function PreventiveAutomationPanel({
  plans = [],
  scripts = [],
  devices = [],
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  canCreate,
  canUpdate,
  canDisable,
  canPrepare,
  onSave,
  onDisable,
  onPrepare
}) {
  const emptyForm = {
    id: null,
    name: "",
    description: "",
    active: true,
    recurrenceType: "monthly",
    recurrenceInterval: 30,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    scopeType: "all",
    scopeId: "",
    defaultScriptIds: [],
    notes: "",
    overrides: []
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [overrideDraft, setOverrideDraft] = useState({
    targetType: "segment",
    targetId: "",
    recurrenceType: "monthly",
    recurrenceInterval: 30,
    preferredTime: "08:00"
  });
  const [saving, setSaving] = useState(false);
  const [preparingId, setPreparingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const activeScripts = scripts.filter((script) => script.active !== false);

  function getScopeOptions(type) {
    if (type === "asset") {
      return devices.map((device) => ({
        id: device.id,
        label: `${device.name || device.id} - ${device.ip || device.segmentName || "sem IP"}`
      }));
    }
    if (type === "segment") return segments.map((segment) => ({ id: segment.id, label: segment.name }));
    if (type === "group") return segmentGroups.map((group) => ({ id: group.id, label: group.name }));
    if (type === "tab") return inventoryTabs.map((tab) => ({ id: tab.id, label: tab.name }));
    return [];
  }

  function getScopeLabel(plan) {
    if (plan.scopeType === "all") return preventiveAutomationScopeLabels.all;
    const option = getScopeOptions(plan.scopeType).find((item) => String(item.id) === String(plan.scopeId));
    return `${preventiveAutomationScopeLabels[plan.scopeType] || "Escopo"}: ${option?.label || plan.scopeId || "não informado"}`;
  }

  function getRecurrenceLabel(plan) {
    const label = preventiveAutomationRecurrenceLabels[plan.recurrenceType] || plan.recurrenceType || "Mensal";
    return `${label} - a cada ${plan.recurrenceInterval || 30} dia(s)`;
  }

  function getRecurrenceShortLabel(plan) {
    if (plan.recurrenceType === "custom_days") {
      return `A cada ${plan.recurrenceInterval || 30} dia(s)`;
    }
    return preventiveAutomationRecurrenceLabels[plan.recurrenceType] || "Mensal";
  }

  function getOverrideLabel(item) {
    const targetType = item.assetId ? "asset" : "segment";
    const targetId = item.assetId || item.segmentId;
    const option = getScopeOptions(targetType).find((scopeOption) => String(scopeOption.id) === String(targetId));
    const targetLabel = option?.label || targetId || "não informado";
    const targetName = targetType === "asset" ? "Máquina" : "Segmento";
    return `${targetName}: ${targetLabel} • ${getRecurrenceShortLabel(item)}`;
  }

  function openCreateModal() {
    setForm(emptyForm);
    setOverridesOpen(false);
    setOverrideDraft({
      targetType: "segment",
      targetId: "",
      recurrenceType: "monthly",
      recurrenceInterval: 30,
      preferredTime: "08:00"
    });
    setModalOpen(true);
  }

  function openEditModal(plan) {
    setForm({
      id: plan.id,
      name: plan.name || "",
      description: plan.description || "",
      active: plan.active !== false,
      recurrenceType: plan.recurrenceType || "monthly",
      recurrenceInterval: plan.recurrenceInterval || 30,
      preferredTime: plan.preferredTime || "08:00",
      timezone: plan.timezone || "America/Sao_Paulo",
      scopeType: plan.scopeType || "all",
      scopeId: plan.scopeId || "",
      defaultScriptIds: Array.isArray(plan.defaultScriptIds) ? plan.defaultScriptIds : [],
      notes: plan.notes || "",
      overrides: Array.isArray(plan.overrides) ? plan.overrides : []
    });
    setOverridesOpen(false);
    setModalOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "scopeType" ? { scopeId: "" } : {}),
      ...(field === "recurrenceType" ? { recurrenceInterval: getDefaultRecurrenceInterval(value) } : {})
    }));
  }

  function toggleScript(scriptId) {
    setForm((current) => {
      const ids = new Set(current.defaultScriptIds || []);
      if (ids.has(scriptId)) ids.delete(scriptId);
      else ids.add(scriptId);
      return { ...current, defaultScriptIds: [...ids] };
    });
  }

  function addOverride() {
    if (!overrideDraft.targetId) return;
    setForm((current) => ({
      ...current,
      overrides: [
        ...(current.overrides || []),
        {
          id: `draft-${Date.now()}`,
          assetId: overrideDraft.targetType === "asset" ? overrideDraft.targetId : null,
          segmentId: overrideDraft.targetType === "segment" ? overrideDraft.targetId : null,
          recurrenceType: overrideDraft.recurrenceType,
          recurrenceInterval: getDefaultRecurrenceInterval(overrideDraft.recurrenceType),
          preferredTime: overrideDraft.preferredTime || "08:00",
          active: true
        }
      ]
    }));
    setOverrideDraft((current) => ({ ...current, targetId: "" }));
  }

  function removeOverride(index) {
    setForm((current) => ({
      ...current,
      overrides: (current.overrides || []).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave(form.id, {
        name: form.name,
        description: form.description,
        active: form.active,
        recurrenceType: form.recurrenceType,
        recurrenceInterval: Number(form.recurrenceInterval || 30),
        preferredTime: form.preferredTime,
        timezone: form.timezone,
        scopeType: form.scopeType,
        scopeId: form.scopeType === "all" ? null : form.scopeId,
        defaultScriptIds: form.defaultScriptIds,
        notes: form.notes,
        overrides: (form.overrides || []).map((item) => ({
          assetId: item.assetId || null,
          segmentId: item.segmentId || null,
          recurrenceType: item.recurrenceType,
          recurrenceInterval: Number(item.recurrenceInterval || 30),
          preferredTime: item.preferredTime || null,
          active: item.active !== false
        }))
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function preparePlan(plan) {
    if (!onPrepare || preparingId) return;
    setPreparingId(plan.id);
    try {
      await onPrepare(plan.id);
    } finally {
      setPreparingId(null);
    }
  }

  async function toggleAutomationPlan(plan) {
    if (togglingId) return;
    setTogglingId(plan.id);
    try {
      if (plan.active !== false && onDisable) {
        await onDisable(plan.id);
        return;
      }
      if (!onSave) return;
      await onSave(plan.id, {
        name: plan.name,
        description: plan.description || "",
        active: true,
        recurrenceType: plan.recurrenceType || "monthly",
        recurrenceInterval: Number(plan.recurrenceInterval || 30),
        preferredTime: plan.preferredTime || "08:00",
        timezone: plan.timezone || "America/Sao_Paulo",
        scopeType: plan.scopeType || "all",
        scopeId: plan.scopeType === "all" ? null : plan.scopeId,
        defaultScriptIds: Array.isArray(plan.defaultScriptIds) ? plan.defaultScriptIds : [],
        notes: plan.notes || "",
        overrides: Array.isArray(plan.overrides) ? plan.overrides : []
      });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="panel preventive-automation-panel">
      <div className="panel-heading">
        <div>
          <h2>Automação Preventiva</h2>
        </div>
        {canCreate && (
          <button type="button" className="primary-action compact-action" onClick={openCreateModal}>
            Novo plano
          </button>
        )}
      </div>

      <div className="preventive-automation-grid">
        {plans.map((plan) => (
          <article key={plan.id} className={`preventive-automation-card ${plan.active === false ? "inactive" : ""}`}>
            <header>
              <div className="preventive-automation-title-row">
                <strong>{plan.name}</strong>
                <span className={`pill ${plan.active === false ? "danger" : "ok"}`}>
                  {plan.active === false ? "Inativo" : "Ativo"}
                </span>
              </div>
              <small>{plan.description || "Sem descrição informada"}</small>
            </header>
            <dl>
              <div>
                <dt>Escopo</dt>
                <dd>{getScopeLabel(plan)}</dd>
              </div>
              <div>
                <dt>Próxima previsão</dt>
                <dd>{formatDate(plan.nextScheduledFor)}</dd>
              </div>
            </dl>
            <footer>
              {(canDisable || canUpdate) && (
                <label className="preventive-automation-switch" title={plan.active === false ? "Ativar automação" : "Desativar automação"}>
                  <input
                    type="checkbox"
                    checked={plan.active !== false}
                    disabled={togglingId === plan.id || (!canDisable && plan.active !== false) || (!canUpdate && plan.active === false)}
                    onChange={() => toggleAutomationPlan(plan)}
                  />
                  <span />
                </label>
              )}
              {canUpdate && (
                <button type="button" className="secondary-action compact-action" onClick={() => openEditModal(plan)}>
                  Editar
                </button>
              )}
              {canDisable && plan.active !== false && (
                <button type="button" className="danger-action compact-action" onClick={() => onDisable?.(plan.id)}>
                  Desativar
                </button>
              )}
            </footer>
          </article>
        ))}

        {!plans.length && <p className="empty">Nenhum plano de automação preventiva cadastrado ainda.</p>}
      </div>

      {modalOpen && (
        <div className="modal-backdrop preventive-automation-backdrop" role="presentation">
          <form className="modal-panel preventive-automation-modal" onSubmit={submitForm}>
            <header>
              <div>
                <span>Automação Preventiva</span>
                <h2>{form.id ? "Editar plano" : "Novo plano"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fechar">
                <XCircle size={18} />
              </button>
            </header>

            <div className="preventive-automation-form-grid">
              <label>
                Nome
                <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
              </label>
              <label>
                Recorrência
                <select value={form.recurrenceType} onChange={(event) => updateForm("recurrenceType", event.target.value)}>
                  {Object.entries(preventiveAutomationRecurrenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {form.recurrenceType === "custom_days" && (
                <label>
                  Repetir a cada (dias)
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={form.recurrenceInterval}
                    onChange={(event) => updateForm("recurrenceInterval", event.target.value)}
                  />
                </label>
              )}
              <label>
                Horário preferencial
                <input type="time" value={form.preferredTime} onChange={(event) => updateForm("preferredTime", event.target.value)} />
              </label>
              <label>
                Escopo
                <select value={form.scopeType} onChange={(event) => updateForm("scopeType", event.target.value)}>
                  {Object.entries(preventiveAutomationScopeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {form.scopeType !== "all" && (
                <label>
                  Alvo
                  <select value={form.scopeId} onChange={(event) => updateForm("scopeId", event.target.value)} required>
                    <option value="">Selecione</option>
                    {getScopeOptions(form.scopeType).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="preventive-automation-wide">
                Descrição
                <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
              </label>
            </div>

            <section className="preventive-automation-scripts">
              <h3>Scripts/verificações</h3>
              <div>
                {activeScripts.map((script) => (
                  <button
                    key={script.id}
                    type="button"
                    className={form.defaultScriptIds.includes(script.id) ? "selected" : ""}
                    onClick={() => toggleScript(script.id)}
                  >
                    <strong>{script.name}</strong>
                    <small>{script.category || script.riskLevel || "Script cadastrado"}</small>
                  </button>
                ))}
                {!activeScripts.length && <p className="empty">Nenhum script ativo cadastrado.</p>}
              </div>
            </section>

            <section className={`preventive-automation-overrides ${overridesOpen ? "open" : ""}`}>
              <button
                type="button"
                className="preventive-automation-overrides-trigger"
                onClick={() => setOverridesOpen((current) => !current)}
                aria-expanded={overridesOpen}
              >
                <span>Recorrência personalizada</span>
                <ChevronDown size={16} />
              </button>
              {overridesOpen && (
                <div className="preventive-automation-overrides-body">
                  <div className="preventive-automation-override-row">
                    <select
                      value={overrideDraft.targetType}
                      onChange={(event) => setOverrideDraft((current) => ({ ...current, targetType: event.target.value, targetId: "" }))}
                    >
                      <option value="segment">Segmento</option>
                      <option value="asset">Máquina</option>
                    </select>
                    <select
                      value={overrideDraft.targetId}
                      onChange={(event) => setOverrideDraft((current) => ({ ...current, targetId: event.target.value }))}
                    >
                      <option value="">Selecione</option>
                      {getScopeOptions(overrideDraft.targetType).map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                    <select
                      value={overrideDraft.recurrenceType}
                      onChange={(event) => setOverrideDraft((current) => ({
                        ...current,
                        recurrenceType: event.target.value,
                        recurrenceInterval: getDefaultRecurrenceInterval(event.target.value)
                      }))}
                    >
                      {Object.entries(preventiveAutomationRecurrenceLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button type="button" className="secondary-action compact-action" onClick={addOverride}>
                      Adicionar
                    </button>
                  </div>
                  <div className="preventive-automation-override-list">
                    {(form.overrides || []).map((item, index) => (
                      <span key={`${item.assetId || item.segmentId}-${index}`} className="pill">
                        {getOverrideLabel(item)}
                        <button type="button" onClick={() => removeOverride(index)} aria-label="Remover recorrência personalizada">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <footer>
              <button type="button" className="secondary-action compact-action" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="primary-action compact-action" disabled={saving}>
                {saving ? "Salvando..." : "Salvar plano"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function AlertCenterV2({
  alerts,
  history,
  suggestions,
  rules,
  scripts,
  preventivePlans = [],
  preventiveAutomationPlans = [],
  devices,
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  alertPriorityColors = defaultPriorityColors,
  alertPrioritySettings = normalizePrioritySettings(),
  alertCorrelations = [],
  serviceOrders,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  suggestionStatusFilter,
  setSuggestionStatusFilter,
  canViewAlerts,
  canManageSuggestions,
  canConfigureAlerts,
  canConfigureAlertPrioritySettings,
  canCommentAlerts,
  canViewScripts,
  canManageScripts,
  canRegisterScriptSimulation,
  canUseScriptsFromAlerts,
  canViewScriptLogs,
  canResolveScriptLogs,
  canManageScriptValidations,
  canViewPreventivePlans,
  canCreatePreventivePlans,
  canCreatePreventiveServiceOrder,
  canViewPreventiveAutomation,
  canCreatePreventiveAutomation,
  canUpdatePreventiveAutomation,
  canDisablePreventiveAutomation,
  canPreparePreventiveAutomation,
  onEvaluateAlerts,
  onAcceptSuggestion,
  onRejectSuggestion,
  onCreatePreventivePlan,
  onCreatePreventivePlanServiceOrder,
  onSavePreventiveAutomationPlan,
  onDisablePreventiveAutomationPlan,
  onPreparePreventiveAutomationPlan,
  onOpenServiceOrders,
  onUpdateRule,
  onAddAlertComment,
  onSaveAlertPrioritySettings,
  onAnalyzeMaintenanceScript,
  onSaveMaintenanceScript,
  onDeactivateMaintenanceScript,
  onRegisterMaintenanceScriptSimulation,
  onUseSuggestionScript,
  onAcknowledgeScriptLog,
  onApplyScriptLogSuggestedSolution,
  onCancelScriptValidation
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertActiveTab, setAlertActiveTab] = useState("suggestions");
  const [settingsSectionsOpen, setSettingsSectionsOpen] = useState({
    rules: false,
    priority: false,
    scripts: false
  });
  const [openScriptMenuSuggestionId, setOpenScriptMenuSuggestionId] = useState(null);
  const [priorityDraft, setPriorityDraft] = useState(() => normalizePrioritySettings(alertPrioritySettings));
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [priorityColorsOpen, setPriorityColorsOpen] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [selectedSuggestionInfoId, setSelectedSuggestionInfoId] = useState(null);
  const [selectedScriptLog, setSelectedScriptLog] = useState(null);
  const [scriptLogCustomNotes, setScriptLogCustomNotes] = useState("");
  const [preventiveSearch, setPreventiveSearch] = useState("");
  const [preventiveFilter, setPreventiveFilter] = useState("all");
  const [selectedPreventiveAssets, setSelectedPreventiveAssets] = useState(() => new Set());
  const [selectedPreventiveScripts, setSelectedPreventiveScripts] = useState(() => new Set());
  const [expandedPreventiveScripts, setExpandedPreventiveScripts] = useState(() => new Set());
  const [preventivePlanName, setPreventivePlanName] = useState("Plano preventivo");
  const [preventiveSaving, setPreventiveSaving] = useState(false);
  const [preventiveServiceOrderSavingId, setPreventiveServiceOrderSavingId] = useState(null);
  const [lastCreatedPreventivePlan, setLastCreatedPreventivePlan] = useState(null);
  const [preventiveReviewOpen, setPreventiveReviewOpen] = useState(false);

  useEffect(() => {
    if (alertActiveTab === "suggestions" && !canViewAlerts) {
      if (canViewPreventivePlans) {
        setAlertActiveTab("preventives");
      } else if (canViewPreventiveAutomation) {
        setAlertActiveTab("automation");
      }
    }
  }, [alertActiveTab, canViewAlerts, canViewPreventiveAutomation, canViewPreventivePlans]);

  useEffect(() => {
    setPriorityDraft(normalizePrioritySettings(alertPrioritySettings));
  }, [alertPrioritySettings]);

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsSectionsOpen({
      rules: false,
      priority: false,
      scripts: false
    });
    setPriorityColorsOpen(false);
  }, [settingsOpen]);

  useEffect(() => {
    const dialogOpen = settingsOpen || preventiveReviewOpen || Boolean(selectedSuggestionInfoId) || Boolean(selectedScriptLog);
    if (!dialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen, preventiveReviewOpen, selectedSuggestionInfoId, selectedScriptLog]);

  useEffect(() => {
    if (!selectedSuggestionInfoId) return undefined;

    function handleSuggestionInfoKeydown(event) {
      if (event.key === "Escape") {
        setSelectedSuggestionInfoId(null);
      }
    }

    window.addEventListener("keydown", handleSuggestionInfoKeydown);
    return () => window.removeEventListener("keydown", handleSuggestionInfoKeydown);
  }, [selectedSuggestionInfoId]);

  useEffect(() => {
    if (!selectedScriptLog) return undefined;

    function handleScriptLogKeydown(event) {
      if (event.key === "Escape") {
        setSelectedScriptLog(null);
      }
    }

    window.addEventListener("keydown", handleScriptLogKeydown);
    return () => window.removeEventListener("keydown", handleScriptLogKeydown);
  }, [selectedScriptLog]);

  const visibleAlerts = history.filter((alert) => {
    const severityMatches = severityFilter === "all" || alert.severity === severityFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && alert.status === "active") ||
      (statusFilter === "resolved" && alert.status === "resolved");

    return severityMatches && statusMatches;
  });
  const visibleSuggestions = suggestions
    .filter((suggestion) => {
      if (suggestionStatusFilter === "all") return suggestion.status === "pending";
      return suggestion.status === suggestionStatusFilter;
    })
    .sort((left, right) => {
      const priorityWeight = { critical: 60, high: 45, medium: 25, low: 10 };
      const leftWeight =
        (priorityWeight[left.suggestedPriority] || 0) +
        (Number(left.occurrencesCount || 1) > 1 ? Math.min(Number(left.occurrencesCount || 1), 8) * 3 : 0);
      const rightWeight =
        (priorityWeight[right.suggestedPriority] || 0) +
        (Number(right.occurrencesCount || 1) > 1 ? Math.min(Number(right.occurrencesCount || 1), 8) * 3 : 0);

      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      return new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0);
    });
  const selectedSuggestionInfo = suggestions.find((suggestion) => suggestion.id === selectedSuggestionInfoId) || null;
  const selectedSuggestionVisibleIndex = visibleSuggestions.findIndex((suggestion) => suggestion.id === selectedSuggestionInfoId);
  const selectedSuggestionIndex = selectedSuggestionVisibleIndex >= 0
    ? selectedSuggestionVisibleIndex
    : Math.max(0, suggestions.findIndex((suggestion) => suggestion.id === selectedSuggestionInfoId));
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length;
  const pendingSuggestions = suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const acceptedSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted").length;
  const recurringAlerts = alerts.filter((alert) => (alert.occurrencesCount || 0) >= 3).length;
  const machinesAtRisk = new Set(
    alerts
      .filter((alert) => alert.status !== "resolved")
      .map((alert) => alert.assetId || alert.hostId || alert.hostName)
      .filter(Boolean)
      .map(String)
  ).size;
  const resolvedAlerts = history.filter((alert) => alert.status === "resolved");
  const handledSuggestions = suggestions.filter((suggestion) => suggestion.status === "accepted" || suggestion.status === "rejected");
  const activeScripts = scripts.filter((script) => script.active !== false);
  const canOpenSettings = canConfigureAlerts || canManageScripts;
  const priorityColorById = useMemo(
    () => ({
      ...defaultPriorityColors,
      ...(alertPriorityColors || {})
    }),
    [alertPriorityColors]
  );
  const deviceById = useMemo(
    () => new Map(devices.map((device) => [String(device.id), device])),
    [devices]
  );
  const segmentById = useMemo(
    () => new Map(segments.map((segment) => [String(segment.id), segment])),
    [segments]
  );
  const groupById = useMemo(
    () => new Map(segmentGroups.map((group) => [String(group.id), group])),
    [segmentGroups]
  );
  const tabById = useMemo(
    () => new Map(inventoryTabs.map((tab) => [String(tab.id), tab])),
    [inventoryTabs]
  );

  function findSuggestionDevice(suggestion) {
    if (suggestion.assetId && deviceById.has(String(suggestion.assetId))) {
      return deviceById.get(String(suggestion.assetId));
    }

    const machineLabel = getSuggestionMachineLabel(suggestion).toLowerCase();
    return devices.find((device) => {
      const names = [device.name, device.id, device.manualAsset?.hostname].filter(Boolean).map((value) => String(value).toLowerCase());
      return names.includes(machineLabel);
    }) || null;
  }

  function findAlertDevice(alert) {
    const identifiers = [alert.assetId, alert.hostId, alert.hostName].filter(Boolean).map(String);

    for (const id of identifiers) {
      if (deviceById.has(id)) return deviceById.get(id);
    }

    const hostLabel = String(alert.hostName || "").toLowerCase();
    return devices.find((device) => {
      const names = [device.name, device.id, device.manualAsset?.hostname].filter(Boolean).map((value) => String(value).toLowerCase());
      return names.includes(hostLabel);
    }) || null;
  }

  function getAlertLocation(alert) {
    const device = findAlertDevice(alert);
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;

    return {
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      groupName: group?.name || "Sem grupo"
    };
  }

  function getAlertMachineLabel(alert) {
    return alert.hostName || findAlertDevice(alert)?.name || alert.assetId || "Máquina não vinculada";
  }

  function getSuggestionLocation(suggestion) {
    const device = findSuggestionDevice(suggestion);
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;

    return {
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      groupName: group?.name || "Sem grupo"
    };
  }

  function getSuggestionAlertShape(suggestion) {
    return {
      id: suggestion.alertId,
      type: suggestion.alertType || suggestion.suggestedProblemTypeId,
      metric: suggestion.alertMetric,
      value: suggestion.alertValue,
      threshold: suggestion.alertThreshold,
      severity: suggestion.alertSeverity || (suggestion.suggestedPriority === "critical" ? "critical" : "warning"),
      status: suggestion.status,
      title: suggestion.title,
      description: suggestion.description,
      hostName: getSuggestionMachineLabel(suggestion),
      occurrencesCount: suggestion.occurrencesCount || 1,
      firstSeenAt: suggestion.alertFirstSeenAt || suggestion.createdAt,
      lastSeenAt: suggestion.alertLastSeenAt || suggestion.updatedAt || suggestion.createdAt,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt
    };
  }

  function getSuggestionCorrelations(suggestion) {
    const machineLabel = getSuggestionMachineLabel(suggestion);
    return alertCorrelations.filter((correlation) => {
      const relatedAlerts = Array.isArray(correlation.relatedAlerts) ? correlation.relatedAlerts : [];
      const relatedHosts = Array.isArray(correlation.relatedHosts) ? correlation.relatedHosts : [];

      return (
        relatedHosts.includes(machineLabel) ||
        relatedAlerts.some((alert) => alert.id === suggestion.alertId || alert.hostName === machineLabel)
      );
    });
  }

  function getSuggestionInfoModel(suggestion) {
    if (!suggestion) return null;

    const alert = getSuggestionAlertShape(suggestion);
    const device = findSuggestionDevice(suggestion);
    const location = suggestion.location || getSuggestionLocation(suggestion);
    const priority = suggestion.suggestedPriority || "medium";
    const comments = Array.isArray(suggestion.comments) ? suggestion.comments : [];
    const checklist = Array.isArray(suggestion.checklist) ? suggestion.checklist : [];
    const correlations = getSuggestionCorrelations(suggestion);

    return {
      alert,
      device,
      location,
      priority,
      priorityLabel: priorityLabels[priority] || priorityLabels.medium,
      machineLabel: getSuggestionMachineLabel(suggestion),
      comments,
      checklist,
      correlations
    };
  }

  function getDevicePreventiveLocation(device) {
    const segment = device?.segmentId ? segmentById.get(String(device.segmentId)) : null;
    const groupId = segment?.groupId || device?.segmentGroupId || "";
    const group = groupId ? groupById.get(String(groupId)) : null;
    const tabId = device?.tabId || segment?.tabId || group?.tabId || "";
    const tab = tabId ? tabById.get(String(tabId)) : null;

    return {
      tabName: tab?.name || device?.tabName || device?.environment || "Ambiente atual",
      groupName: group?.name || "Sem grupo",
      segmentName: segment?.name || device?.segmentName || "Não organizadas",
      segmentId: segment?.id || device?.segmentId || "unorganized"
    };
  }

  function getScriptRecommendationReason(script, contextText) {
    const normalizedContext = normalizeText(contextText);
    const normalizedScript = normalizeText([
      script.name,
      script.description,
      script.category,
      script.alertType,
      script.problemType,
      script.estimatedSummary
    ].filter(Boolean).join(" "));

    if (!normalizedContext || !normalizedScript) return "";
    if (normalizedContext.includes("disco") && normalizedScript.includes("disco")) {
      return "Recomendado porque o contexto indica problema de disco.";
    }
    if ((normalizedContext.includes("ram") || normalizedContext.includes("memoria")) && normalizedScript.includes("sistema")) {
      return "Recomendado para coletar dados de desempenho e memória.";
    }
    if ((normalizedContext.includes("offline") || normalizedContext.includes("rede") || normalizedContext.includes("ping")) && normalizedScript.includes("rede")) {
      return "Recomendado porque o contexto indica instabilidade de rede.";
    }
    if (normalizedContext.includes("impressora") && normalizedScript.includes("impressora")) {
      return "Recomendado porque o contexto envolve impressora.";
    }
    if (script.alertType && normalizedContext.includes(normalizeText(script.alertType))) {
      return "Recomendado pelo tipo de aviso vinculado ao script.";
    }
    return "";
  }

  function getRecommendedScriptsForContext(contextText) {
    return activeScripts
      .map((script) => ({
        ...script,
        recommendationReason: getScriptRecommendationReason(script, contextText)
      }))
      .filter((script) => script.recommendationReason)
      .slice(0, 4);
  }

  function getScriptList(script, key) {
    const value = script?.[key];
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getRecommendedScriptsForContextV2(contextText) {
    const normalizedContext = normalizeText(contextText);

    return activeScripts
      .map((script) => {
        const fields = [
          script.name,
          script.description,
          script.category,
          script.alertType,
          script.problemType,
          script.estimatedSummary,
          ...getScriptList(script, "tags"),
          ...getScriptList(script, "relatedAlertTypes"),
          ...getScriptList(script, "relatedProblemTypes"),
          ...getScriptList(script, "recommendedForCategories")
        ];
        const normalizedScript = normalizeText(fields.filter(Boolean).join(" "));
        const metadataMatches = [
          ...getScriptList(script, "tags"),
          ...getScriptList(script, "relatedAlertTypes"),
          ...getScriptList(script, "relatedProblemTypes"),
          ...getScriptList(script, "recommendedForCategories"),
          script.alertType,
          script.problemType,
          script.category
        ]
          .map((item) => normalizeText(item))
          .filter((item) => item && normalizedContext.includes(item));
        let score = metadataMatches.length ? 30 + metadataMatches.length * 5 : 0;
        let reason = metadataMatches.length
          ? `Recomendado por contexto: ${metadataMatches.slice(0, 2).join(", ")}.`
          : "";

        if (normalizedContext.includes("disco") && normalizedScript.includes("disco")) {
          score += 20;
          reason ||= "Recomendado porque o contexto indica problema de disco.";
        }
        if ((normalizedContext.includes("ram") || normalizedContext.includes("memoria")) && normalizedScript.includes("sistema")) {
          score += 16;
          reason ||= "Recomendado para coletar dados de desempenho e memoria.";
        }
        if ((normalizedContext.includes("offline") || normalizedContext.includes("rede") || normalizedContext.includes("ping")) && normalizedScript.includes("rede")) {
          score += 18;
          reason ||= "Recomendado porque o contexto indica instabilidade de rede.";
        }
        if (normalizedContext.includes("impressora") && normalizedScript.includes("impressora")) {
          score += 18;
          reason ||= "Recomendado porque o contexto envolve impressora.";
        }

        return {
          ...script,
          recommendationScore: score,
          recommendationReason: reason
        };
      })
      .filter((script) => script.recommendationScore > 0)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 6);
  }

  function togglePreventiveAsset(assetId) {
    setSelectedPreventiveAssets((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function togglePreventiveScript(scriptId) {
    setSelectedPreventiveScripts((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  }

  function togglePreventiveScriptDetails(scriptId) {
    setExpandedPreventiveScripts((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  }

  function togglePreventiveSegment(segmentId, assetIds) {
    setSelectedPreventiveAssets((current) => {
      const next = new Set(current);
      const allSelected = assetIds.every((assetId) => next.has(assetId));

      for (const assetId of assetIds) {
        if (allSelected) {
          next.delete(assetId);
        } else {
          next.add(assetId);
        }
      }

      return next;
    });
  }

  function openPreventiveReview() {
    if (!canCreatePreventivePlans || preventiveSaving || !selectedPreventiveAssets.size || !selectedPreventiveScripts.size) return;
    setPreventiveReviewOpen(true);
  }

  async function confirmPreventivePlanRegistration() {
    if (!onCreatePreventivePlan || preventiveSaving) return;
    const selectedScripts = activeScripts.filter((script) => selectedPreventiveScripts.has(script.id));
    const hasHighRiskScript = selectedScripts.some((script) => script.riskLevel === "high" || script.riskLevel === "critical");

    setPreventiveSaving(true);
    try {
      const createdPlan = await onCreatePreventivePlan({
        name: preventivePlanName,
        description: "Plano preventivo registrado pela tela de Avisos.",
        source: "manual",
        notes: "",
        riskAcknowledged: hasHighRiskScript,
        assetIds: [...selectedPreventiveAssets],
        scriptIds: [...selectedPreventiveScripts]
      });
      setSelectedPreventiveAssets(new Set());
      setSelectedPreventiveScripts(new Set());
      setExpandedPreventiveScripts(new Set());
      setLastCreatedPreventivePlan(createdPlan);
      setPreventiveReviewOpen(false);
    } finally {
      setPreventiveSaving(false);
    }
  }

  async function createPreventiveServiceOrder(plan) {
    if (!plan?.id || preventiveServiceOrderSavingId || !onCreatePreventivePlanServiceOrder) return;

    setPreventiveServiceOrderSavingId(plan.id);
    try {
      const result = await onCreatePreventivePlanServiceOrder(plan.id);
      if (result?.preventivePlan) {
        setLastCreatedPreventivePlan(result.preventivePlan);
      }
    } finally {
      setPreventiveServiceOrderSavingId(null);
    }
  }

  function openPreventiveServiceOrder() {
    if (onOpenServiceOrders) {
      onOpenServiceOrders();
    }
  }

  const preventiveDueDays = Number(priorityDraft.preventiveDueDays || alertPrioritySettings.preventiveDueDays || 180);

  function getLastPreventiveForAsset(assetId) {
    const matches = preventivePlans
      .filter((plan) =>
        Array.isArray(plan.assets) && plan.assets.some((asset) => String(asset.assetId) === String(assetId))
      )
      .map((plan) => {
        const asset = plan.assets.find((item) => String(item.assetId) === String(assetId));
        const date = asset?.preparedAt || plan.preparedAt || plan.createdAt;

        return {
          plan,
          asset,
          date,
          timestamp: new Date(date || 0).getTime()
        };
      })
      .sort((left, right) => right.timestamp - left.timestamp);

    return matches[0] || null;
  }

  function getDevicePreventiveInfo(device) {
    const location = getDevicePreventiveLocation(device);
    const lastPreventive = getLastPreventiveForAsset(device.id);
    const relatedAlerts = alerts.filter((alert) => {
      const alertDevice = findAlertDevice(alert);
      return alertDevice?.id === device.id && alert.status !== "resolved";
    });
    const criticalAlerts = relatedAlerts.filter((alert) => alert.severity === "critical").length;
    const isInMaintenance =
      Boolean(device.maintenance || device.maintenanceActive) ||
      device.maintenanceStatus === "active" ||
      isMaintenanceSegmentName(device.segmentName);
    const isBackup = Boolean(device.isBackup);
    const lastTimestamp = lastPreventive?.timestamp || null;
    const daysSinceLastPreventive = lastTimestamp
      ? Math.max(0, Math.floor((Date.now() - lastTimestamp) / 86400000))
      : null;
    const nextPreventiveDueAt = lastTimestamp
      ? new Date(lastTimestamp + preventiveDueDays * 86400000).toISOString()
      : null;
    const isOverdue = Number.isFinite(daysSinceLastPreventive) && daysSinceLastPreventive > preventiveDueDays;
    let preventiveStatus = "up_to_date";
    let preventiveStatusLabel = "Preventiva em dia";
    let urgency = 10;

    if (!lastPreventive) {
      preventiveStatus = "no_preventive";
      preventiveStatusLabel = "Sem preventiva";
      urgency = 70;
    } else if (isOverdue) {
      preventiveStatus = "overdue";
      preventiveStatusLabel = "Preventiva vencida";
      urgency = 82;
    }

    if (relatedAlerts.length) urgency = Math.max(urgency, 62);
    if (criticalAlerts) {
      preventiveStatus = "critical";
      preventiveStatusLabel = "Crítica";
      urgency = 100;
    }
    if (isInMaintenance) urgency = Math.max(urgency, 90);
    if (isBackup && !criticalAlerts && !isInMaintenance) urgency = Math.min(urgency, 20);

    const badges = [
      {
        label: preventiveStatusLabel,
        tone: preventiveStatus === "up_to_date" ? "ok" : preventiveStatus === "critical" ? "danger" : "warning"
      }
    ];

    if (relatedAlerts.length) {
      badges.push({
        label: `${relatedAlerts.length} aviso(s)`,
        tone: criticalAlerts ? "danger" : "warning"
      });
    }
    if (isInMaintenance) badges.push({ label: "Em manutenção", tone: "warning" });
    if (isBackup) badges.push({ label: "Backup", tone: "neutral" });

    return {
      device,
      location,
      lastPreventive,
      activeAlertsCount: relatedAlerts.length,
      criticalAlertsCount: criticalAlerts,
      isInMaintenance,
      isBackup,
      isOverdue,
      preventiveStatus,
      preventiveStatusLabel,
      nextPreventiveDueAt,
      daysSinceLastPreventive,
      urgency,
      badges
    };
  }

  const preventiveOverview = devices.map(getDevicePreventiveInfo);
  const preventiveSummary = preventiveOverview.reduce(
    (summary, item) => {
      if (item.preventiveStatus === "no_preventive") summary.withoutPreventive += 1;
      if (item.isOverdue) summary.overdue += 1;
      if (item.preventiveStatus === "up_to_date") summary.upToDate += 1;
      if (item.activeAlertsCount) summary.withAlerts += 1;
      return summary;
    },
    { withoutPreventive: 0, overdue: 0, upToDate: 0, withAlerts: 0 }
  );

  const preventiveDevices = preventiveOverview.filter((item) => {
    const { device, location } = item;
    const term = normalizeText(preventiveSearch);
    const matchesFilter =
      preventiveFilter === "all" ||
      (preventiveFilter === "no_preventive" && item.preventiveStatus === "no_preventive") ||
      (preventiveFilter === "overdue" && item.isOverdue) ||
      (preventiveFilter === "up_to_date" && item.preventiveStatus === "up_to_date") ||
      (preventiveFilter === "alerts" && item.activeAlertsCount > 0) ||
      (preventiveFilter === "maintenance" && item.isInMaintenance) ||
      (preventiveFilter === "backup" && item.isBackup);

    if (!matchesFilter) return false;
    if (!term) return true;

    return [
      device.name,
      device.id,
      device.ip,
      device.statusLabel,
      device.type,
      device.assetType,
      location.tabName,
      location.groupName,
      location.segmentName,
      item.preventiveStatusLabel,
      item.lastPreventive?.plan?.name
    ]
      .filter(Boolean)
      .some((value) => normalizeText(value).includes(term));
  }).sort((left, right) => {
    if (right.urgency !== left.urgency) return right.urgency - left.urgency;
    return String(left.device.name || left.device.id).localeCompare(String(right.device.name || right.device.id));
  });

  const preventiveGroups = preventiveDevices.reduce((groups, device) => {
    const location = device.location;
    const key = `${location.tabName}::${location.groupName}::${location.segmentName}`;
    const current = groups.get(key) || {
      key,
      ...location,
      devices: []
    };
    current.devices.push(device);
    groups.set(key, current);
    return groups;
  }, new Map());
  const selectedPreventiveDevices = devices.filter((device) => selectedPreventiveAssets.has(device.id));
  const preventiveContextText = [
    ...selectedPreventiveDevices.flatMap((device) => {
      const location = getDevicePreventiveLocation(device);
      return [
        device.name,
        device.type,
        device.assetType,
        device.statusLabel,
        location.groupName,
        location.segmentName
      ];
    }),
    ...alerts
      .filter((alert) => {
        const device = findAlertDevice(alert);
        return device?.id && selectedPreventiveAssets.has(device.id);
      })
      .flatMap((alert) => [alert.type, alert.metric, alert.title, alert.category])
  ].filter(Boolean).join(" ");
  const recommendedPreventiveScripts = getRecommendedScriptsForContextV2(preventiveContextText);
  const orderedPreventiveScripts = [
    ...recommendedPreventiveScripts,
    ...activeScripts.filter((script) => !recommendedPreventiveScripts.some((recommended) => recommended.id === script.id))
  ];
  const selectedPreventiveScriptList = activeScripts.filter((script) => selectedPreventiveScripts.has(script.id));
  const selectedPreventiveRiskList = selectedPreventiveScriptList.filter((script) =>
    script.riskLevel === "high" || script.riskLevel === "critical"
  );
  const preventivePlanCount = preventivePlans.length;

  function toggleAlertSettingsSection(section) {
    setSettingsSectionsOpen((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  function updatePriorityDraft(section, field, value) {
    setPriorityDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
  }

  function updateAlertOperationalDraft(field, value) {
    setPriorityDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function changePriorityDraftColor(priority, color) {
    setPriorityDraft((current) => ({
      ...current,
      priorityColors: {
        ...current.priorityColors,
        [priority]: color
      }
    }));
  }

  async function savePriorityDraft() {
    if (!onSaveAlertPrioritySettings) return;
    setPrioritySaving(true);
    try {
      const normalized = normalizePrioritySettings(priorityDraft);
      const saved = await onSaveAlertPrioritySettings(normalized);
      setPriorityDraft(normalizePrioritySettings(saved || normalized));
    } finally {
      setPrioritySaving(false);
    }
  }

  function getSuggestionLatestValidation(suggestion) {
    return suggestion?.latestValidation || null;
  }

  function openScriptLogPreview() {
    const latestValidationWithLog = suggestions
      .map((suggestion) => getSuggestionLatestValidation(suggestion))
      .find((validation) => validation?.log);

    if (latestValidationWithLog?.log) {
      setSelectedScriptLog({
        ...latestValidationWithLog.log,
        scriptName: latestValidationWithLog.scriptName,
        validationStatus: latestValidationWithLog.status
      });
      return;
    }

    setSelectedScriptLog({
      id: "preview-log",
      previewOnly: true,
      scriptName: "Prévia de logs",
      status: "Sem logs registrados",
      parsedSummary: "Nenhum log de script disponível para esta sessão.",
      errorDetected: false,
      errorType: "Não informado",
      acknowledgedAt: null,
      probableCause: "Nenhum log pendente foi encontrado.",
      suggestedSolution: "Use os botões de script nos cards de sugestão para gerar registros de validação.",
      rawLog: "Nenhum log bruto disponível."
    });
  }

  async function handleUseSuggestionScript(suggestion, script) {
    const baseConfirmation =
      "Esta acao apenas registrara o uso do script na sugestao e iniciara a validacao visual. Nenhum comando sera executado na maquina ou no servidor.";
    const highRisk = script.riskLevel === "high" || script.riskLevel === "critical";

    if (!window.confirm(baseConfirmation)) return;

    if (highRisk) {
      const riskConfirmation =
        "Este script foi marcado como alto risco. A execucao real nao esta disponivel nesta versao. Deseja apenas registrar a validacao preparada?";
      if (!window.confirm(riskConfirmation)) return;
    }

    await onUseSuggestionScript(suggestion.id, script.id, {
      mode: "prepared",
      confirmed: true,
      riskAcknowledged: highRisk,
      validationWindowMinutes: priorityDraft.scriptValidationWindowMinutes,
      notes: `Script selecionado no card ${formatSuggestionCode(suggestion)}. Nenhum comando foi executado.`
    });
    setOpenScriptMenuSuggestionId(null);
  }

  async function submitAlertComment(alertId) {
    const message = String(commentDrafts[alertId] || "").trim();
    if (!message || !onAddAlertComment) return;
    await onAddAlertComment(alertId, message);
    setCommentDrafts((current) => ({ ...current, [alertId]: "" }));
  }

  const selectedSuggestionInfoModel = getSuggestionInfoModel(selectedSuggestionInfo);

  return (
    <section className="view-stack alerts-view-v2">
      {(canViewAlerts || canViewPreventivePlans || canViewPreventiveAutomation) && (
        <>
          {canViewAlerts && alertActiveTab === "suggestions" && (
            <div className="alerts-view-header">
              <section className="summary-grid compact-summary alerts-summary">
                <SummaryCard icon={Bell} label="Avisos ativos" value={alerts.length} tone="warning" />
                <SummaryCard icon={AlertTriangle} label="Críticos" value={criticalAlerts} tone="danger" />
                <SummaryCard icon={ClipboardList} label="Sugestões pendentes" value={pendingSuggestions} tone="warning" />
                <SummaryCard icon={CheckCircle} label="OS criadas por aviso" value={acceptedSuggestions} tone="ok" />
                <SummaryCard icon={RefreshCw} label="Avisos recorrentes" value={recurringAlerts} tone="info" />
                <SummaryCard icon={Monitor} label="Máquinas em risco" value={machinesAtRisk} tone="danger" />
              </section>
            </div>
          )}

          <nav className="alerts-internal-tabs" aria-label="Áreas da Central de Avisos">
            {canViewAlerts && (
              <button
                type="button"
                className={alertActiveTab === "suggestions" ? "active" : ""}
                onClick={() => setAlertActiveTab("suggestions")}
              >
                Sugestões de OS
              </button>
            )}
            {canViewPreventivePlans && (
              <button
                type="button"
                className={alertActiveTab === "preventives" ? "active" : ""}
                onClick={() => setAlertActiveTab("preventives")}
              >
                Preventivas
              </button>
            )}
            {canViewPreventiveAutomation && (
              <button
                type="button"
                className={alertActiveTab === "automation" ? "active" : ""}
                onClick={() => setAlertActiveTab("automation")}
              >
                Automação
              </button>
            )}
            {canViewScriptLogs && (
              <button
                type="button"
                className="icon-button alerts-log-tab-button"
                onClick={openScriptLogPreview}
                title="Abrir tela de log"
                aria-label="Abrir tela de log"
              >
                <Plus size={18} />
              </button>
            )}
            {canOpenSettings && (
              <button
                type="button"
                className="icon-button alerts-settings-trigger alerts-settings-tab-button"
                onClick={() => setSettingsOpen(true)}
                title="Configurações de aviso"
                aria-label="Configurações de aviso"
              >
                <SettingsIcon size={18} />
              </button>
            )}
          </nav>

          {alertActiveTab === "active" && (
            <section className="panel alerts-diagnostics-panel">
              <div className="panel-heading">
                <div>
                  <h2>Avisos ativos</h2>
                  <p>Diagnóstico preventivo com impacto, evidência e ação recomendada.</p>
                </div>
                {canManageSuggestions && (
                  <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
                    Avaliar recorrência
                  </button>
                )}
              </div>
              {alertCorrelations.length > 0 && (
                <section className="alert-correlations-section" aria-label="Avisos correlacionados">
                  <header>
                    <div>
                      <h3>Avisos correlacionados</h3>
                      <p>Padrões agrupados por tipo, grupo e segmento para apoiar a triagem.</p>
                    </div>
                  </header>
                  <div className="alert-correlations-grid">
                    {alertCorrelations.slice(0, 4).map((correlation) => (
                      <article key={correlation.correlationId || correlation.id} className={`alert-correlation-card ${correlation.impactLevel === "critical" ? "critical" : "warning"}`}>
                        <span>{correlation.confidenceLevel || "Média"} confiança</span>
                        <strong>{correlation.correlationSummary}</strong>
                        <small>{(correlation.relatedHosts || []).join(", ")}</small>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              <div className="alert-board alert-diagnostics-board">
                {visibleAlerts
                  .filter((alert) => alert.status !== "resolved")
                  .map((alert) => {
                    const location = alert.location || getAlertLocation(alert);
                    const machineLabel = getAlertMachineLabel(alert);
                    const comments = Array.isArray(alert.comments) ? alert.comments : [];
                    const checklist = Array.isArray(alert.checklist) ? alert.checklist : [];

                    return (
                      <article key={alert.id} className={`alert-diagnostic-card ${alert.severity}`}>
                        <header>
                          <div>
                            <span>{alert.category || getAlertCategory(alert)}</span>
                            <h3>{alert.title}</h3>
                            <small>{machineLabel} · {location.groupName} · {location.segmentName}</small>
                          </div>
                          <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                            {alert.severity === "critical" ? "Crítico" : "Atenção"}
                          </span>
                        </header>
                        <dl>
                          <div>
                            <dt>Valor atual</dt>
                            <dd>{formatAlertValue(alert)}</dd>
                          </div>
                          <div>
                            <dt>Limite</dt>
                            <dd>{formatAlertThreshold(alert)}</dd>
                          </div>
                          <div>
                            <dt>Ocorrências</dt>
                            <dd>{alert.occurrencesCount || 1}</dd>
                          </div>
                          <div>
                            <dt>Confiança</dt>
                            <dd>{alert.confidenceLevel || getAlertConfidence(alert)}</dd>
                          </div>
                          <div>
                            <dt>Tendência</dt>
                            <dd>{alert.trend || getAlertTrend(alert)}</dd>
                          </div>
                          <div>
                            <dt>Score</dt>
                            <dd>{Math.round(alert.recurrenceScore || 0) || "N/D"}</dd>
                          </div>
                        </dl>
                        <p><strong>Motivo da prioridade:</strong> {alert.priorityReason || "Prioridade definida pela regra atual do aviso."}</p>
                        <p><strong>Impacto:</strong> {alert.operationalImpact || getAlertImpact(alert)}</p>
                        <p><strong>Causa provável:</strong> {alert.probableCause || getAlertProbableCause(alert)}</p>
                        <p><strong>Ação recomendada:</strong> {alert.recommendedAction || getAlertRecommendedAction(alert)}</p>
                        {alert.recurrenceInsight && (
                          <p><strong>Reincidência:</strong> {alert.recurrenceInsight.summary}</p>
                        )}
                        {alert.falsePositiveInsight && (
                          <p><strong>Possível falso positivo:</strong> {alert.falsePositiveInsight.summary}</p>
                        )}
                        {alert.capacityForecast?.summary && (
                          <p><strong>Capacidade:</strong> {alert.capacityForecast.summary}</p>
                        )}
                        {!!checklist.length && (
                          <div className="alert-checklist">
                            <strong>Checklist sugerido</strong>
                            <ul>
                              {checklist.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="alert-comments">
                          <strong>Comentários internos</strong>
                          {comments.slice(-2).map((comment) => (
                            <p key={comment.id}>
                              <span>{comment.userName || "Usuário"} · {formatDate(comment.createdAt)}</span>
                              {comment.message}
                            </p>
                          ))}
                          {!comments.length && <small>Nenhum comentário registrado.</small>}
                          {canCommentAlerts && (
                            <div className="alert-comment-form">
                              <input
                                value={commentDrafts[alert.id] || ""}
                                onChange={(event) => setCommentDrafts((current) => ({ ...current, [alert.id]: event.target.value }))}
                                placeholder="Adicionar comentário interno"
                              />
                              <button type="button" className="secondary-action compact-action" onClick={() => submitAlertComment(alert.id)}>
                                Comentar
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                {!visibleAlerts.filter((alert) => alert.status !== "resolved").length && (
                  <p className="empty">Nenhum aviso ativo encontrado para os filtros atuais.</p>
                )}
              </div>
            </section>
          )}

          {alertActiveTab === "suggestions" && (
          <section className="alerts-workspace-grid">
            <section className="panel suggestions-panel">
              <div className="panel-heading">
                <div>
                  <h2>Sugestões de OS</h2>
                  <p>Aviso recorrente só vira Ordem de Serviço quando alguém aceita a sugestão.</p>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="toolbar inline-toolbar">
                <select value={suggestionStatusFilter} onChange={(event) => setSuggestionStatusFilter(event.target.value)}>
                  <option value="all">Todas as sugestões</option>
                  <option value="pending">Pendentes</option>
                  <option value="accepted">Aceitas</option>
                  <option value="rejected">Recusadas</option>
                </select>
              </div>
              <div className="alert-board suggestion-board">
                {visibleSuggestions.map((suggestion, index) => {
                  const machineLabel = getSuggestionMachineLabel(suggestion);
                  const location = suggestion.location || getSuggestionLocation(suggestion);
                  const priority = suggestion.suggestedPriority || "medium";
                  const priorityLabel = priorityLabels[priority] || priorityLabels.medium;
                  const priorityColor = priorityColorById[priority] || priorityColorById.medium;
                  const locationLabel = `${location.groupName} • ${location.segmentName}`;
                  const occurrenceCount = Number(suggestion.occurrencesCount || 1);
                  const recommendedScripts = getRecommendedScriptsForContextV2([
                    suggestion.title,
                    suggestion.description,
                    suggestion.alertType,
                    suggestion.alertMetric,
                    suggestion.category,
                    suggestion.suggestedProblemTypeId,
                    machineLabel,
                    locationLabel
                  ].filter(Boolean).join(" "));
                  const otherScripts = activeScripts.filter((script) =>
                    !recommendedScripts.some((recommended) => recommended.id === script.id)
                  );

                  const latestValidation = getSuggestionLatestValidation(suggestion);
                  const validationStatus = latestValidation?.status || "";
                  const hasPendingScriptLog = Boolean(
                    latestValidation?.log?.attentionRequired && !latestValidation.log.acknowledgedAt
                  );

                  return (
                    <article
                      key={suggestion.id}
                      className="service-order-card suggestion-card"
                      style={{
                        "--service-order-priority-color": priorityColor,
                        "--service-order-priority-bg": `color-mix(in srgb, ${priorityColor} 32%, var(--surface))`
                      }}
                      title={suggestion.priorityReason || suggestion.title}
                    >
                      {occurrenceCount > 1 && (
                        <span
                          className="suggestion-recurrence-indicator"
                          title={`Este aviso ocorreu ${occurrenceCount} vezes no período configurado.`}
                        >
                          <RefreshCw size={12} />
                          {occurrenceCount}x
                        </span>
                      )}
                      {latestValidation && (
                        <span
                          className={`suggestion-validation-indicator ${validationStatus}`}
                          title={getScriptValidationTooltip(latestValidation)}
                        >
                          {validationStatus === "validation_success" ? <CheckCircle size={13} /> : <SettingsIcon size={13} />}
                        </span>
                      )}
                      <span>{formatSuggestionCode(suggestion, index)}</span>
                      <strong title={suggestion.title}>{suggestion.title}</strong>
                      <small title={machineLabel}>{machineLabel}</small>
                      <small className="suggestion-card-location" title={locationLabel}>{locationLabel}</small>
                      <div className="suggestion-card-badges">
                        <em title={priorityLabel}>{priorityLabel}</em>
                        <em title="Preventiva">Preventiva</em>
                      </div>
                      <footer>
                        <ClipboardList size={14} />
                        <span title="Sistema">Sistema</span>
                        <time>{formatDate(suggestion.createdAt)}</time>
                      </footer>
                      <div className="suggestion-actions">
                        {canManageSuggestions && suggestion.status === "pending" && (
                          <>
                          <button type="button" className="primary-action compact-action" onClick={() => onAcceptSuggestion(suggestion.id)}>
                            Criar OS
                          </button>
                          <button
                            type="button"
                            className="danger-action compact-action suggestion-reject-trigger"
                            onClick={() => onRejectSuggestion(suggestion.id)}
                            title="Recusar"
                            aria-label="Recusar"
                          >
                            <XCircle size={15} />
                          </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="icon-button suggestion-info-trigger"
                          title="Ver detalhes do aviso"
                          aria-label="Ver detalhes do aviso"
                          onClick={() => {
                            setOpenScriptMenuSuggestionId(null);
                            setSelectedSuggestionInfoId(suggestion.id);
                          }}
                        >
                          <Info size={15} />
                        </button>
                        {hasPendingScriptLog && canViewScriptLogs && (
                          <button
                            type="button"
                            className="icon-button suggestion-log-trigger"
                            title="Ver log do script"
                            aria-label="Ver log do script"
                            onClick={() => {
                              setOpenScriptMenuSuggestionId(null);
                              setSelectedScriptLog({
                                ...latestValidation.log,
                                scriptName: latestValidation.scriptName,
                                validationStatus: latestValidation.status
                              });
                            }}
                          >
                            <AlertTriangle size={15} />
                          </button>
                        )}
                        {canManageSuggestions && suggestion.status === "pending" && canViewScripts && (
                            <div className="suggestion-script-menu">
                              <button
                                type="button"
                                className="icon-button suggestion-script-trigger"
                                title="Scripts disponíveis"
                                aria-label="Scripts disponíveis"
                                onClick={() =>
                                  setOpenScriptMenuSuggestionId((current) =>
                                    current === suggestion.id ? null : suggestion.id
                                  )
                                }
                              >
                                <KeyRound size={15} />
                              </button>
                              {openScriptMenuSuggestionId === suggestion.id && (
                                <div className="suggestion-script-popover">
                                  <strong>Scripts disponíveis</strong>
                                  {!!recommendedScripts.length && (
                                    <section>
                                      <em>Recomendado</em>
                                      {recommendedScripts.map((script) => (
                                        <button
                                          key={script.id}
                                          type="button"
                                          disabled={!canUseScriptsFromAlerts}
                                          onClick={() => handleUseSuggestionScript(suggestion, script)}
                                        >
                                          <span>{script.name}</span>
                                          <small>{script.recommendationReason || script.estimatedSummary || "Registro manual"}</small>
                                        </button>
                                      ))}
                                    </section>
                                  )}
                                  {!!otherScripts.length && (
                                    <section>
                                      <em>Outros scripts disponiveis</em>
                                      {otherScripts.map((script) => (
                                        <button
                                          key={script.id}
                                          type="button"
                                          disabled={!canUseScriptsFromAlerts}
                                          onClick={() => handleUseSuggestionScript(suggestion, script)}
                                        >
                                          <span>{script.name}</span>
                                          <small>{script.estimatedSummary || script.category || "Registro manual"}</small>
                                        </button>
                                      ))}
                                    </section>
                                  )}
                                  {!activeScripts.length && <p>Nenhum script ativo cadastrado.</p>}
                                </div>
                              )}
                            </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!visibleSuggestions.length && <p className="empty">Nenhuma sugestão encontrada para os filtros atuais.</p>}
              </div>
            </section>

            <section className="panel alerts-compact-panel">
              <div className="panel-heading">
                <div>
                  <h2>Central de avisos</h2>
                  <p>Resumo dos avisos simulados.</p>
                </div>
                <Bell size={18} />
              </div>
              <div className="toolbar inline-toolbar">
                <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                  <option value="all">Todas</option>
                  <option value="critical">Críticos</option>
                  <option value="warning">Atenção</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="resolved">Resolvidos</option>
                </select>
                {canManageSuggestions && (
                  <button type="button" className="primary-action compact-action" onClick={onEvaluateAlerts}>
                    Avaliar
                  </button>
                )}
              </div>
              <div className="alert-board compact-alert-board">
                {visibleAlerts.map((alert) => (
                  <article key={alert.id} className={`alert-card compact-alert-card ${alert.severity}`}>
                    <div>
                      <span className={`pill ${alert.status === "resolved" ? "ok" : "warning"}`}>
                        {alert.status === "resolved" ? "Resolvido" : "Ativo"}
                      </span>
                      <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                        {alert.severity === "critical" ? "Crítico" : "Atenção"}
                      </span>
                    </div>
                    <h3>{alert.title}</h3>
                    <p>{alert.hostName} · {formatAlertValue(alert)}</p>
                    <small>{alertTypeLabels[alert.type] || alert.type || alert.metric}</small>
                  </article>
                ))}
                {!visibleAlerts.length && <p className="empty">Nenhum aviso encontrado para os filtros atuais.</p>}
              </div>
            </section>
          </section>
          )}

          {alertActiveTab === "preventives" && canViewPreventivePlans && (
            <section className="panel preventive-plans-panel">
              <div className="panel-heading">
                <div>
                  <h2>Preventivas</h2>
                </div>
                <ClipboardList size={18} />
              </div>

              {lastCreatedPreventivePlan && (
                <section className="preventive-created-summary">
                  <div>
                    <span>Plano registrado</span>
                    <strong>{lastCreatedPreventivePlan.name}</strong>
                    <small>
                      {lastCreatedPreventivePlan.assets?.length || 0} máquina(s) •{" "}
                      {lastCreatedPreventivePlan.scripts?.length || 0} verificação(ões) •{" "}
                      {formatDate(lastCreatedPreventivePlan.preparedAt || lastCreatedPreventivePlan.createdAt)}
                    </small>
                  </div>
                  {lastCreatedPreventivePlan.serviceOrderId ? (
                    <button type="button" className="secondary-action compact-action" onClick={openPreventiveServiceOrder}>
                      Abrir OS preventiva
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-action compact-action"
                      disabled={!canCreatePreventiveServiceOrder || preventiveServiceOrderSavingId === lastCreatedPreventivePlan.id}
                      onClick={() => createPreventiveServiceOrder(lastCreatedPreventivePlan)}
                    >
                      {preventiveServiceOrderSavingId === lastCreatedPreventivePlan.id ? "Criando OS..." : "Criar OS preventiva"}
                    </button>
                  )}
                </section>
              )}

              <section className="preventive-summary-grid" aria-label="Resumo preventivo">
                <article>
                  <span>Sem preventiva</span>
                  <strong>{preventiveSummary.withoutPreventive}</strong>
                </article>
                <article>
                  <span>Preventivas vencidas</span>
                  <strong>{preventiveSummary.overdue}</strong>
                </article>
                <article>
                  <span>Preventivas em dia</span>
                  <strong>{preventiveSummary.upToDate}</strong>
                </article>
                <article>
                  <span>Com avisos ativos</span>
                  <strong>{preventiveSummary.withAlerts}</strong>
                </article>
                <article>
                  <span>Planos registrados</span>
                  <strong>{preventivePlanCount}</strong>
                </article>
              </section>

              <div className={`preventive-workspace ${selectedPreventiveAssets.size ? "has-selection" : "single-step"}`}>
                <section className="preventive-device-groups" aria-label="Máquinas para preventiva">
                  <div className="preventive-step-header">
                    <span>Etapa 1</span>
                    <div>
                      <strong>Selecionar máquinas</strong>
                    </div>
                  </div>
                  <div className="preventive-toolbar">
                    <label className="compact-search preventive-search">
                      <Search size={16} />
                      <input
                        value={preventiveSearch}
                        onChange={(event) => setPreventiveSearch(event.target.value)}
                        placeholder="Buscar máquina, grupo, segmento ou ambiente"
                      />
                    </label>
                    <select
                      className="preventive-status-filter"
                      value={preventiveFilter}
                      onChange={(event) => setPreventiveFilter(event.target.value)}
                      aria-label="Filtrar status preventivo"
                    >
                      <option value="all">Todas</option>
                      <option value="no_preventive">Sem preventiva</option>
                      <option value="overdue">Vencida</option>
                      <option value="up_to_date">Em dia</option>
                      <option value="alerts">Com avisos</option>
                      <option value="maintenance">Em manutenção</option>
                      <option value="backup">Backup</option>
                    </select>
                    <div className="preventive-plan-summary">
                      <strong>{selectedPreventiveAssets.size}</strong>
                      <span>máquina(s) selecionada(s)</span>
                    </div>
                  </div>

                  <div className="preventive-group-list">
                    {Array.from(preventiveGroups.values()).map((group) => {
                      const assetIds = group.devices.map((item) => item.device.id);
                      const selectedCount = assetIds.filter((assetId) => selectedPreventiveAssets.has(assetId)).length;

                      return (
                        <section key={group.key} className="preventive-device-group">
                          <header>
                            <div>
                              <strong>{group.groupName} • {group.segmentName}</strong>
                              <small>{group.devices.length} máquina(s) neste segmento</small>
                            </div>
                            <button
                              type="button"
                              className="secondary-action compact-action"
                              disabled={!canCreatePreventivePlans}
                              onClick={() => togglePreventiveSegment(group.segmentId, assetIds)}
                            >
                              {selectedCount === assetIds.length ? "Remover segmento" : "Selecionar segmento"}
                            </button>
                          </header>

                          <div className="preventive-device-list">
                            {group.devices.map((item) => {
                              const { device, badges, nextPreventiveDueAt, daysSinceLastPreventive } = item;
                              const lastPreventive = item.lastPreventive
                                ? {
                                    ...item.lastPreventive.plan,
                                    preparedAt: item.lastPreventive.date,
                                    createdAt: item.lastPreventive.date
                                  }
                                : null;
                              const isSelected = selectedPreventiveAssets.has(device.id);
                              const nextPreventiveLabel = nextPreventiveDueAt
                                ? `Próxima sugerida: ${formatDate(nextPreventiveDueAt)}`
                                : `Vence após ${preventiveDueDays} dia(s) da primeira preventiva`;

                              return (
                                <button
                                  key={device.id}
                                  type="button"
                                  className={`preventive-device-row ${isSelected ? "selected" : ""}`}
                                  disabled={!canCreatePreventivePlans}
                                  onClick={() => togglePreventiveAsset(device.id)}
                                >
                                  <span className="preventive-device-check" aria-hidden="true">
                                    {isSelected ? "✓" : ""}
                                  </span>
                                  <span>
                                    <strong>{device.name || device.id}</strong>
                                    <small>{device.type || device.assetType || "Ativo"} • {device.statusLabel || device.status || "Sem status"}</small>
                                  </span>
                                  <em>
                                    {lastPreventive ? `Última preventiva: ${formatDate(lastPreventive.preparedAt || lastPreventive.createdAt)}` : "Sem preventiva registrada"}
                                  </em>
                                  {lastPreventive?.name && <small className="preventive-plan-used">Plano: {lastPreventive.name}</small>}
                                  <small className="preventive-next-date">
                                    {daysSinceLastPreventive !== null ? `${daysSinceLastPreventive} dia(s) desde a última • ` : ""}
                                    {nextPreventiveLabel}
                                  </small>
                                  <span className="preventive-device-badges">
                                    {badges.map((badge) => (
                                      <span key={`${device.id}-${badge.label}`} className={`pill ${badge.tone}`}>{badge.label}</span>
                                    ))}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}

                    {!preventiveGroups.size && (
                      <p className="empty">Nenhuma máquina encontrada para os filtros atuais.</p>
                    )}
                  </div>
                </section>

                {selectedPreventiveAssets.size > 0 && (
                <aside className="preventive-plan-builder ready" aria-label="Criar plano preventivo">
                  <header>
                    <span className="preventive-step-pill">Etapa 2</span>
                    <h3>Selecionar verificações/scripts</h3>
                  </header>

                  <label>
                    Nome do plano
                    <input
                      value={preventivePlanName}
                      disabled={!canCreatePreventivePlans}
                      onChange={(event) => setPreventivePlanName(event.target.value)}
                    />
                  </label>

                  <section className="preventive-script-list">
                    <div>
                      <h4>Verificações selecionáveis</h4>
                      <p>{recommendedPreventiveScripts.length ? "Recomendações aparecem primeiro." : "Selecione máquinas para melhorar as recomendações."}</p>
                    </div>
                    {orderedPreventiveScripts.map((script) => {
                      const selected = selectedPreventiveScripts.has(script.id);
                      const expanded = expandedPreventiveScripts.has(script.id);
                      const scriptDetails =
                        script.description ||
                        script.estimatedSummary ||
                        script.recommendationReason ||
                        script.category ||
                        "Sem descrição cadastrada para este script.";
                      return (
                        <article
                          key={script.id}
                          className={`preventive-script-option ${selected ? "selected" : ""} ${expanded ? "expanded" : ""}`}
                        >
                          <button
                            type="button"
                            className="preventive-script-select"
                            disabled={!canCreatePreventivePlans}
                            onClick={() => togglePreventiveScript(script.id)}
                          >
                            <span className="preventive-device-check" aria-hidden="true">
                              {selected ? "✓" : ""}
                            </span>
                            <span>
                              <strong>{script.name}</strong>
                              <small>{script.recommendationReason || script.estimatedSummary || script.category || "Script cadastrado"}</small>
                            </span>
                            <em>{script.riskLevel || "médio"}</em>
                          </button>
                          <button
                            type="button"
                            className="icon-button preventive-script-expand"
                            onClick={() => togglePreventiveScriptDetails(script.id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Recolher descrição do script" : "Expandir descrição do script"}
                            title={expanded ? "Recolher descrição" : "Ver descrição"}
                          >
                            <ChevronDown size={16} />
                          </button>
                          {expanded && (
                            <div className="preventive-script-details">
                              <strong>O que faz</strong>
                              <p>{scriptDetails}</p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                    {!orderedPreventiveScripts.length && (
                      <p className="empty">Nenhuma verificação/script ativo cadastrado.</p>
                    )}
                  </section>

                  <div className="preventive-plan-summary-card">
                    <span>{selectedPreventiveAssets.size} máquina(s)</span>
                    <span>{selectedPreventiveScriptList.length} verificação(ões)</span>
                  </div>

                  <button
                    type="button"
                    className="primary-action compact-action"
                    disabled={
                      !canCreatePreventivePlans ||
                      preventiveSaving ||
                      !selectedPreventiveAssets.size ||
                      !selectedPreventiveScripts.size
                    }
                    onClick={openPreventiveReview}
                  >
                    {preventiveSaving ? "Executando..." : "Executar"}
                  </button>
                </aside>
                )}
              </div>
            </section>
          )}

          {preventiveReviewOpen && (
            <div className="modal-backdrop preventive-review-backdrop" role="presentation">
              <section
                className="modal-panel preventive-review-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="preventive-review-title"
              >
                <header>
                  <div>
                    <span>Revisão da preventiva</span>
                    <h2 id="preventive-review-title">Registrar plano preventivo</h2>
                    <p>
                      Confira o escopo antes de registrar. Esta tela não executa scripts nem envia comandos para
                      máquinas.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setPreventiveReviewOpen(false)}
                    aria-label="Fechar revisão"
                  >
                    <XCircle size={18} />
                  </button>
                </header>

                <div className="preventive-review-grid">
                  <section>
                    <h3>Plano</h3>
                    <dl>
                      <div>
                        <dt>Nome</dt>
                        <dd>{preventivePlanName || "Plano preventivo"}</dd>
                      </div>
                      <div>
                        <dt>Origem</dt>
                        <dd>Manual, pelo módulo de Avisos</dd>
                      </div>
                    </dl>
                  </section>

                  <section>
                    <h3>Máquinas selecionadas</h3>
                    <strong>{selectedPreventiveDevices.length} máquina(s)</strong>
                    <ul>
                      {selectedPreventiveDevices.slice(0, 6).map((device) => (
                        <li key={device.id}>{device.name || device.id}</li>
                      ))}
                      {selectedPreventiveDevices.length > 6 && (
                        <li>+ {selectedPreventiveDevices.length - 6} máquina(s)</li>
                      )}
                    </ul>
                  </section>

                  <section>
                    <h3>Verificações selecionadas</h3>
                    <strong>{selectedPreventiveScriptList.length} verificação(ões)</strong>
                    <ul>
                      {selectedPreventiveScriptList.map((script) => (
                        <li key={script.id}>
                          {script.name}
                          <span>{script.riskLevel || "médio"}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3>Riscos</h3>
                    {selectedPreventiveRiskList.length ? (
                      <ul>
                        {selectedPreventiveRiskList.map((script) => (
                          <li key={script.id}>{script.name} — {script.riskLevel}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Nenhuma verificação de alto risco selecionada.</p>
                    )}
                  </section>
                </div>

                <footer>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setPreventiveReviewOpen(false)}
                    disabled={preventiveSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={confirmPreventivePlanRegistration}
                    disabled={preventiveSaving}
                  >
                    {preventiveSaving ? "Executando..." : "Executar"}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {alertActiveTab === "automation" && canViewPreventiveAutomation && (
            <PreventiveAutomationPanel
              plans={preventiveAutomationPlans}
              scripts={activeScripts}
              devices={devices}
              segments={segments}
              segmentGroups={segmentGroups}
              inventoryTabs={inventoryTabs}
              canCreate={canCreatePreventiveAutomation}
              canUpdate={canUpdatePreventiveAutomation}
              canDisable={canDisablePreventiveAutomation}
              canPrepare={canPreparePreventiveAutomation}
              onSave={onSavePreventiveAutomationPlan}
              onDisable={onDisablePreventiveAutomationPlan}
              onPrepare={onPreparePreventiveAutomationPlan}
            />
          )}

          {alertActiveTab === "history" && (
            <section className="panel alerts-history-panel">
              <div className="panel-heading">
                <div>
                  <h2>Histórico de avisos</h2>
                  <p>Avisos resolvidos, sugestões aceitas e recusas registradas.</p>
                </div>
                <ClipboardList size={18} />
              </div>
              <div className="alert-board alert-history-board">
                {resolvedAlerts.map((alert) => {
                  const machineLabel = getAlertMachineLabel(alert);
                  return (
                    <article key={alert.id} className="alert-history-card">
                      <span className="pill ok">Resolvido</span>
                      <h3>{alert.title}</h3>
                      <p>{machineLabel} · {formatAlertValue(alert)}</p>
                      <small>{formatDate(alert.updatedAt || alert.resolvedAt || alert.startedAt)}</small>
                    </article>
                  );
                })}
                {handledSuggestions.map((suggestion, index) => (
                  <article key={suggestion.id} className="alert-history-card">
                    <span className={`pill ${suggestion.status === "accepted" ? "ok" : "danger"}`}>
                      {suggestionStatusLabels[suggestion.status] || suggestion.status}
                    </span>
                    <h3>{formatSuggestionCode(suggestion, index)} · {suggestion.title}</h3>
                    <p>{getSuggestionMachineLabel(suggestion)}</p>
                    <small>{suggestion.createdServiceOrderId ? `OS criada: ${suggestion.createdServiceOrderId}` : suggestion.rejectionReason || "Sem observação"}</small>
                  </article>
                ))}
                {!resolvedAlerts.length && !handledSuggestions.length && (
                  <p className="empty">Nenhum histórico encontrado ainda.</p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {selectedSuggestionInfo && selectedSuggestionInfoModel && (
        <div
          className="modal-backdrop suggestion-info-backdrop"
          onMouseDown={() => setSelectedSuggestionInfoId(null)}
        >
          <section
            className="modal-panel suggestion-info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="suggestion-info-header">
              <div>
                <span>{formatSuggestionCode(selectedSuggestionInfo, selectedSuggestionIndex)}</span>
                <h2 id="suggestion-info-title">{selectedSuggestionInfo.title}</h2>
                <p>
                  {selectedSuggestionInfoModel.machineLabel} - {selectedSuggestionInfoModel.location.groupName} - {selectedSuggestionInfoModel.location.segmentName}
                </p>
                <div className="suggestion-info-badges">
                  <span className={`pill ${selectedSuggestionInfo.status === "accepted" ? "ok" : selectedSuggestionInfo.status === "rejected" ? "danger" : "warning"}`}>
                    {suggestionStatusLabels[selectedSuggestionInfo.status] || selectedSuggestionInfo.status}
                  </span>
                  <span className={`pill ${selectedSuggestionInfoModel.priority === "critical" ? "danger" : "warning"}`}>
                    {selectedSuggestionInfoModel.priorityLabel}
                  </span>
                  <span className="pill">{selectedSuggestionInfo.category || getAlertCategory(selectedSuggestionInfoModel.alert)}</span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedSuggestionInfoId(null)}
                aria-label="Fechar detalhes do aviso"
                title="Fechar detalhes do aviso"
              >
                <XCircle size={18} />
              </button>
            </header>

            <div className="suggestion-info-body">
              <section className="suggestion-info-section">
                <h3>Informações da máquina</h3>
                <div className="suggestion-info-grid">
                  <div className="suggestion-info-item">
                    <span>Nome</span>
                    <strong>{selectedSuggestionInfoModel.machineLabel}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Tipo do ativo</span>
                    <strong>{selectedSuggestionInfoModel.device?.type || selectedSuggestionInfoModel.device?.manualAsset?.type || selectedSuggestionInfo.category || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>IP</span>
                    <strong>{selectedSuggestionInfoModel.device?.ip || selectedSuggestionInfoModel.device?.manualAsset?.ip || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Sistema operacional</span>
                    <strong>{selectedSuggestionInfoModel.device?.os || selectedSuggestionInfoModel.device?.manualAsset?.os || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Aba/Ambiente</span>
                    <strong>{selectedSuggestionInfoModel.device?.tabName || selectedSuggestionInfoModel.device?.environment || "Não informado"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Grupo</span>
                    <strong>{selectedSuggestionInfoModel.location.groupName}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Segmento</span>
                    <strong>{selectedSuggestionInfoModel.location.segmentName}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Backup</span>
                    <strong>{selectedSuggestionInfoModel.device?.isBackup ? "Sim" : "Não"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Em manutenção</span>
                    <strong>{selectedSuggestionInfoModel.device?.maintenanceActive || selectedSuggestionInfoModel.device?.maintenanceStatus === "active" ? "Sim" : "Não"}</strong>
                  </div>
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Informações do aviso</h3>
                <div className="suggestion-info-grid">
                  <div className="suggestion-info-item">
                    <span>Tipo</span>
                    <strong>{alertTypeLabels[selectedSuggestionInfoModel.alert.type] || selectedSuggestionInfoModel.alert.type || "Aviso preventivo"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Categoria</span>
                    <strong>{selectedSuggestionInfo.category || getAlertCategory(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Métrica</span>
                    <strong>{selectedSuggestionInfoModel.alert.metric || "Não informada"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Valor atual</span>
                    <strong>{formatAlertValue(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Limite</span>
                    <strong>{formatAlertThreshold(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Ocorrências</span>
                    <strong>{selectedSuggestionInfoModel.alert.occurrencesCount || 1}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Primeira ocorrência</span>
                    <strong>{formatDate(selectedSuggestionInfoModel.alert.firstSeenAt)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Última ocorrência</span>
                    <strong>{formatDate(selectedSuggestionInfoModel.alert.lastSeenAt)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Confiança</span>
                    <strong>{selectedSuggestionInfo.confidenceLevel || getAlertConfidence(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Tendência</span>
                    <strong>{selectedSuggestionInfo.trend || getAlertTrend(selectedSuggestionInfoModel.alert)}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Score/Risco</span>
                    <strong>{Math.round(selectedSuggestionInfo.recurrenceScore || 0) || "N/D"}</strong>
                  </div>
                  <div className="suggestion-info-item">
                    <span>Origem</span>
                    <strong>Sistema</strong>
                  </div>
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Explicações técnicas</h3>
                <div className="suggestion-info-text-list">
                  <p><strong>Motivo da prioridade:</strong> {selectedSuggestionInfo.priorityReason || "Prioridade definida pela regra atual do aviso."}</p>
                  <p><strong>Impacto operacional:</strong> {selectedSuggestionInfo.operationalImpact || getAlertImpact(selectedSuggestionInfoModel.alert)}</p>
                  <p><strong>Causa provável:</strong> {selectedSuggestionInfo.probableCause || getAlertProbableCause(selectedSuggestionInfoModel.alert)}</p>
                  <p><strong>Ação recomendada:</strong> {selectedSuggestionInfo.recommendedAction || getAlertRecommendedAction(selectedSuggestionInfoModel.alert)}</p>
                  {selectedSuggestionInfo.recurrenceInsight?.summary && (
                    <p><strong>Reincidência:</strong> {selectedSuggestionInfo.recurrenceInsight.summary}</p>
                  )}
                  {selectedSuggestionInfo.falsePositiveInsight?.summary && (
                    <p><strong>Possível falso positivo:</strong> {selectedSuggestionInfo.falsePositiveInsight.summary}</p>
                  )}
                  {selectedSuggestionInfo.capacityForecast?.summary && (
                    <p><strong>Capacidade/previsão:</strong> {selectedSuggestionInfo.capacityForecast.summary}</p>
                  )}
                </div>
              </section>

              <section className="suggestion-info-section">
                <h3>Checklist sugerido</h3>
                {!!selectedSuggestionInfoModel.checklist.length ? (
                  <ul className="suggestion-info-checklist">
                    {selectedSuggestionInfoModel.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="suggestion-info-empty">Nenhum item de checklist cadastrado para este aviso.</p>
                )}
              </section>

              <section className="suggestion-info-section">
                <h3>Correlação</h3>
                {!!selectedSuggestionInfoModel.correlations.length ? (
                  <div className="suggestion-info-correlations">
                    {selectedSuggestionInfoModel.correlations.map((correlation) => (
                      <article key={correlation.correlationId || correlation.id}>
                        <span>{correlation.confidenceLevel || "Média"} confiança</span>
                        <strong>{correlation.correlationSummary || "Aviso correlacionado"}</strong>
                        <small>{(correlation.relatedHosts || []).join(", ") || "Sem máquinas relacionadas"}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="suggestion-info-empty">Nenhuma correlação encontrada para esta sugestão.</p>
                )}
              </section>

              <section className="suggestion-info-section">
                <h3>Comentários internos</h3>
                <div className="alert-comments suggestion-info-comments">
                  {selectedSuggestionInfoModel.comments.map((comment) => (
                    <p key={comment.id}>
                      <span>{comment.userName || "Usuário"} - {formatDate(comment.createdAt)}</span>
                      {comment.message}
                    </p>
                  ))}
                  {!selectedSuggestionInfoModel.comments.length && <small>Nenhum comentário registrado.</small>}
                  {canCommentAlerts && selectedSuggestionInfo.alertId && (
                    <div className="alert-comment-form">
                      <input
                        value={commentDrafts[selectedSuggestionInfo.alertId] || ""}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [selectedSuggestionInfo.alertId]: event.target.value }))}
                        placeholder="Adicionar comentário interno"
                      />
                      <button type="button" className="secondary-action compact-action" onClick={() => submitAlertComment(selectedSuggestionInfo.alertId)}>
                        Comentar
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="suggestion-info-footer">
              {canManageSuggestions && selectedSuggestionInfo.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="primary-action compact-action"
                    onClick={async () => {
                      await onAcceptSuggestion(selectedSuggestionInfo.id);
                      setSelectedSuggestionInfoId(null);
                    }}
                  >
                    Criar OS
                  </button>
                  <button
                    type="button"
                    className="danger-action compact-action"
                    onClick={async () => {
                      await onRejectSuggestion(selectedSuggestionInfo.id);
                      setSelectedSuggestionInfoId(null);
                    }}
                  >
                    Recusar
                  </button>
                </>
              )}
              <button type="button" className="secondary-action compact-action" onClick={() => setSelectedSuggestionInfoId(null)}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {selectedScriptLog && (
        <div className="modal-backdrop suggestion-info-backdrop" onMouseDown={() => setSelectedScriptLog(null)}>
          <section className="modal-panel script-log-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>LOG DE SCRIPT</span>
                <h2>{selectedScriptLog.scriptName || "Registro de script"}</h2>
                <p>{selectedScriptLog.parsedSummary || "Registro preparado para validacao segura."}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedScriptLog(null)} aria-label="Fechar log">
                <XCircle size={18} />
              </button>
            </header>
            <div className="script-log-body">
              <section className="script-log-summary">
                <div>
                  <span>Status</span>
                  <strong>{selectedScriptLog.status || "Registrado"}</strong>
                </div>
                <div>
                  <span>Erro detectado</span>
                  <strong>{selectedScriptLog.errorDetected ? "Sim" : "Nao"}</strong>
                </div>
                <div>
                  <span>Tipo de erro</span>
                  <strong>{selectedScriptLog.errorType || "Nao informado"}</strong>
                </div>
                <div>
                  <span>Reconhecido</span>
                  <strong>{selectedScriptLog.acknowledgedAt ? formatDate(selectedScriptLog.acknowledgedAt) : "Pendente"}</strong>
                </div>
              </section>
              <section>
                <h3>Causa provavel</h3>
                <p>{selectedScriptLog.probableCause || "Nenhuma causa especifica foi identificada."}</p>
              </section>
              <section>
                <h3>Solucao sugerida</h3>
                <p>{selectedScriptLog.suggestedSolution || "Revise o script, o acesso ao ativo e as permissoes antes de qualquer execucao futura."}</p>
              </section>
              <section>
                <h3>Log tecnico</h3>
                <pre className="script-log-raw">{selectedScriptLog.rawLog || selectedScriptLog.parsedSummary || "Nenhum log bruto informado."}</pre>
              </section>
              {canResolveScriptLogs && !selectedScriptLog.previewOnly && (
                <label className="script-log-custom-solution">
                  Solucao propria
                  <textarea
                    value={scriptLogCustomNotes}
                    onChange={(event) => setScriptLogCustomNotes(event.target.value)}
                    placeholder="Descreva a correcao que sera registrada sem executar comandos."
                  />
                </label>
              )}
            </div>
            <footer className="script-log-actions">
              {canResolveScriptLogs && !selectedScriptLog.previewOnly && (
                <>
                  <button
                    type="button"
                    className="primary-action compact-action"
                    onClick={async () => {
                      const confirmed = window.confirm(
                        "Esta acao nao executara comandos automaticamente nesta versao. Ela registrara uma acao corretiva sugerida para acompanhamento."
                      );
                      if (!confirmed) return;
                      await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, {
                        notes: selectedScriptLog.suggestedSolution || "Solucao sugerida registrada para acompanhamento."
                      });
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Aplicar solucao sugerida
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={async () => {
                      const notes = scriptLogCustomNotes.trim() || "Solucao propria registrada pelo tecnico.";
                      await onApplyScriptLogSuggestedSolution(selectedScriptLog.id, { notes });
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Usar minha propria solucao
                  </button>
                  <button
                    type="button"
                    className="secondary-action compact-action"
                    onClick={async () => {
                      await onAcknowledgeScriptLog(selectedScriptLog.id);
                      setSelectedScriptLog(null);
                      setScriptLogCustomNotes("");
                    }}
                  >
                    Cancelar
                  </button>
                </>
              )}
              <button type="button" className="secondary-action compact-action" onClick={() => setSelectedScriptLog(null)}>
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop alert-settings-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="modal-panel alert-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header className="alert-settings-modal-header">
              <div>
                <span>AVISOS</span>
                <h2>Configurações de aviso</h2>
                <p>Regras de recorrência, limites e cadastro seguro de scripts de manutenção.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)}>
                <XCircle size={18} />
              </button>
            </header>

            {canViewAlerts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.rules ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("rules")}
                >
                  <div>
                    <h2>Regras de aviso</h2>
                    <p>Limites usados para sugerir Ordens de Serviço.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.rules && (
                  <section className="panel alert-settings-section">
                    <div className="alert-settings-control-grid">
                      <label>
                        Ignorar aviso recusado por (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.rejectedAlertSilenceHours}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => updateAlertOperationalDraft("rejectedAlertSilenceHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Resetar recorrência a cada (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.recurrenceCounterResetHours}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => updateAlertOperationalDraft("recurrenceCounterResetHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Preventiva vence em (dias)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.preventiveDueDays}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => updateAlertOperationalDraft("preventiveDueDays", event.target.value)}
                        />
                      </label>
                      <label>
                        Validacao de script (minutos)
                        <input
                          type="number"
                          min="5"
                          max="10080"
                          value={priorityDraft.scriptValidationWindowMinutes}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => updateAlertOperationalDraft("scriptValidationWindowMinutes", event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="secondary-action compact-action"
                        disabled={!canConfigureAlerts || prioritySaving}
                        onClick={savePriorityDraft}
                      >
                        {prioritySaving ? "Salvando..." : "Salvar janelas"}
                      </button>
                    </div>
                <div className="settings-table alert-rules-table">
                  <div className="settings-table-head">
                    <span>Tipo</span>
                    <span>Limite</span>
                    <span>Tempo mínimo</span>
                    <span>Recorrência</span>
                    <span>Janela</span>
                    <span>Prioridade da OS</span>
                    <span>Status</span>
                  </div>
                  {rules.map((rule) => (
                    <div key={rule.id} className="settings-table-row alert-rule-row">
                      <span>{alertTypeLabels[rule.type] || rule.type}</span>
                      <span>
                        <input
                          type="number"
                          min="0"
                          value={rule.threshold ?? ""}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { threshold: event.target.value })}
                        />
                      </span>
                      <span>
                        <input
                          type="number"
                          min="0"
                          value={rule.durationMinutes}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { durationMinutes: event.target.value })}
                        />
                      </span>
                      <span>
                        <input
                          type="number"
                          min="1"
                          value={rule.recurrenceCount}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { recurrenceCount: event.target.value })}
                        />
                      </span>
                      <span>
                        <select
                          value={rule.recurrenceWindow}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { recurrenceWindow: event.target.value })}
                        >
                          <option value="same_day">Mesmo dia</option>
                          <option value="last_24h">Últimas 24 horas</option>
                          <option value="custom">Período configurável</option>
                        </select>
                      </span>
                      <span>
                        <select
                          value={rule.suggestedPriority || "medium"}
                          disabled={!canConfigureAlerts}
                          onChange={(event) => onUpdateRule(rule.id, { suggestedPriority: event.target.value })}
                        >
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </span>
                      <span>
                        <label className="inline-check">
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            disabled={!canConfigureAlerts}
                            onChange={(event) => onUpdateRule(rule.id, { enabled: event.target.checked })}
                          />
                          Ativa
                        </label>
                      </span>
                    </div>
                  ))}
                </div>
                  </section>
                )}
              </section>
            )}

            {canViewAlerts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.priority ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("priority")}
                >
                  <div>
                    <h2>Prioridade</h2>
                    <p>Cores e tempos usados pelas prioridades das Ordens de Serviço.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.priority && (
                  <section className="panel alert-settings-section">
                    <div className="service-order-number-settings alert-priority-settings">
                      <label>
                        Baixa para Média (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.lowToMediumHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "lowToMediumHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Média para Alta (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.mediumToHighHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "mediumToHighHours", event.target.value)}
                        />
                      </label>
                      <label>
                        Alta para Crítica (horas)
                        <input
                          type="number"
                          min="1"
                          value={priorityDraft.autoPriority.highToCriticalHours}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "highToCriticalHours", event.target.value)}
                        />
                      </label>
                      <label className="settings-inline-check service-order-priority-enabled">
                        <input
                          type="checkbox"
                          checked={Boolean(priorityDraft.autoPriority.enabled)}
                          disabled={!canConfigureAlertPrioritySettings}
                          onChange={(event) => updatePriorityDraft("autoPriority", "enabled", event.target.checked)}
                        />
                        Ativar mudança automática de prioridade
                      </label>
                      <button
                        type="button"
                        className="secondary-action compact-action alert-priority-color-toggle"
                        disabled={!canConfigureAlertPrioritySettings}
                        onClick={() => setPriorityColorsOpen((current) => !current)}
                      >
                        <Palette size={15} />
                        {priorityColorsOpen ? "Ocultar cores" : "Cores"}
                      </button>
                      {priorityColorsOpen && (
                        <div className="service-order-priority-colors service-order-priority-colors-expanded">
                          {Object.entries(priorityLabels).map(([priority, label]) => (
                            <label key={priority}>
                              <span className="service-order-color-swatch" style={{ background: priorityDraft.priorityColors[priority] }} />
                              {label}
                              <input
                                type="color"
                                value={priorityDraft.priorityColors[priority]}
                                disabled={!canConfigureAlertPrioritySettings}
                                onChange={(event) => changePriorityDraftColor(priority, event.target.value)}
                                aria-label={`Cor da prioridade ${label}`}
                              />
                            </label>
                          ))}
                          <button
                            type="button"
                            className="ghost-action compact-action"
                            disabled={!canConfigureAlertPrioritySettings}
                            onClick={() => setPriorityDraft((current) => ({ ...current, priorityColors: defaultPriorityColors }))}
                          >
                            <RotateCcw size={15} />
                            Padrão
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="primary-action compact-action alert-priority-save"
                        disabled={!canConfigureAlertPrioritySettings || prioritySaving}
                        onClick={savePriorityDraft}
                      >
                        <Palette size={15} />
                        {prioritySaving ? "Salvando..." : "Salvar prioridade"}
                      </button>
                    </div>
                  </section>
                )}
              </section>
            )}

            {canViewScripts && (
              <section className={`alert-settings-accordion ${settingsSectionsOpen.scripts ? "open" : ""}`}>
                <button
                  type="button"
                  className="alert-settings-accordion-trigger"
                  onClick={() => toggleAlertSettingsSection("scripts")}
                >
                  <div>
                    <h2>Scripts de manutenção</h2>
                    <p>Cadastro seguro, análise textual e scripts disponíveis nos cards.</p>
                  </div>
                  <ChevronDown size={18} />
                </button>
                {settingsSectionsOpen.scripts && (
                  <div className="alert-settings-accordion-body">
                    <MaintenanceScriptsPanel
                      scripts={scripts}
                      devices={devices}
                      serviceOrders={serviceOrders}
                      alerts={alerts}
                      canManage={canManageScripts}
                      canRegisterSimulation={canRegisterScriptSimulation}
                      showHeader={false}
                      showSafetyBanner={false}
                      showSimulation={false}
                      onAnalyze={onAnalyzeMaintenanceScript}
                      onSave={onSaveMaintenanceScript}
                      onDeactivate={onDeactivateMaintenanceScript}
                      onRegisterSimulation={onRegisterMaintenanceScriptSimulation}
                    />
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function DeviceDetails({ device }) {
  if (!device) {
    return (
      <section className="panel details-empty">
        <Monitor size={24} />
        <p>Selecione um dispositivo para ver detalhes.</p>
      </section>
    );
  }
  const isManualAsset = device.source === "manual";

  return (
    <section className="panel details-panel">
      <div className="panel-heading">
        <div>
          <h2>{device.name}</h2>
          <p>{device.ip} - {device.hardware?.os}</p>
        </div>
        <span className={`pill ${statusClass(device.status)}`}>{device.statusLabel}</span>
      </div>

      {isManualAsset ? (
        <div className="network-card">
          <Network size={18} />
          <span>Status por ping: {device.statusLabel || (device.status === "offline" ? "Erro" : "Online")}</span>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <MetricBar label="CPU" value={device.metrics.cpu} icon={Cpu} />
            <MetricBar label="RAM" value={device.metrics.ram} icon={MemoryStick} />
            <MetricBar label="Disco" value={device.metrics.disk} icon={HardDrive} />
          </div>

          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={device.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7dde9" />
                <XAxis dataKey="time" stroke="#69758a" />
                <YAxis stroke="#69758a" />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#d64545" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ram" stroke="#d6a21f" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="disk" stroke="#2f9e73" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="inventory-grid">
        <div>
          <span>Fabricante</span>
          <strong>{device.hardware?.manufacturer}</strong>
        </div>
        <div>
          <span>Modelo</span>
          <strong>{device.hardware?.model}</strong>
        </div>
        <div>
          <span>{isManualAsset ? "Tipo" : "CPU"}</span>
          <strong>{isManualAsset ? device.assetType : device.hardware?.cpuModel}</strong>
        </div>
        <div>
          <span>{isManualAsset ? "Patrimônio" : "Memória"}</span>
          <strong>{isManualAsset ? device.hardware?.assetTag : `${device.hardware?.ramGb} GB`}</strong>
        </div>
        <div>
          <span>Uptime</span>
          <strong>{device.uptimeHours} h</strong>
        </div>
        <div>
          <span>Inventário</span>
          <strong>{formatDate(device.hardware?.lastInventoryAt)}</strong>
        </div>
      </div>

      <div className="software-list">
        {device.hardware?.software.map((software) => <span key={software}>{software}</span>)}
      </div>
    </section>
  );
}

function PermissionBlocked() {
  return (
    <section className="permission-blocked-panel">
      <ShieldCheck size={26} />
      <h2>Você não possui permissão para acessar este módulo.</h2>
      <p>Peça para um administrador liberar o acesso necessário nas Configurações Gerais.</p>
    </section>
  );
}

function Dashboard({ token, user, theme, onToggleTheme, onLogout, notify }) {
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState([]);
  const [segments, setSegments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [alertCorrelations, setAlertCorrelations] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [serviceOrderSuggestions, setServiceOrderSuggestions] = useState([]);
  const [maintenanceScripts, setMaintenanceScripts] = useState([]);
  const [preventivePlans, setPreventivePlans] = useState([]);
  const [preventiveAutomationPlans, setPreventiveAutomationPlans] = useState([]);
  const [serviceOrders, setServiceOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState("all");
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedInventoryGroup, setSelectedInventoryGroup] = useState("all");
  const [selectedInventorySegment, setSelectedInventorySegment] = useState("all");
  const [machineAliases, setMachineAliases] = useState(() =>
    JSON.parse(localStorage.getItem(aliasKey) || "{}")
  );
  const [machineObservations, setMachineObservations] = useState(() =>
    JSON.parse(localStorage.getItem(observationsKey) || "{}")
  );
  const [removedPeripherals, setRemovedPeripherals] = useState(() =>
    JSON.parse(localStorage.getItem(peripheralRemovalsKey) || "{}")
  );
  const [peripheralHistory, setPeripheralHistory] = useState(() =>
    JSON.parse(localStorage.getItem(peripheralHistoryKey) || "{}")
  );
  const [maintenanceRecords, setMaintenanceRecords] = useState(() =>
    readStoredJson(maintenanceRecordsKey, {})
  );
  const [inventoryTabs, setInventoryTabs] = useState(() =>
    normalizeInventoryTabs(readStoredJson(inventoryTabsKey, [defaultInventoryTab]))
  );
  const [activeInventoryTabId, setActiveInventoryTabId] = useState(() =>
    localStorage.getItem(activeInventoryTabKey) || defaultInventoryTab.id
  );
  const [inventoryTabMeta, setInventoryTabMeta] = useState(() =>
    normalizeInventoryTabMeta(readStoredJson(inventoryTabMetaKey, {}))
  );
  const [segmentGroups, setSegmentGroups] = useState([]);
  const [moveModal, setMoveModal] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [segmentForm, setSegmentForm] = useState(null);
  const [segmentGroupForm, setSegmentGroupForm] = useState(null);
  const [inventoryTabForm, setInventoryTabForm] = useState(null);
  const [manualAssetFormOpen, setManualAssetFormOpen] = useState(false);
  const [manualAssetSaving, setManualAssetSaving] = useState(false);
  const [segmentGroupSaving, setSegmentGroupSaving] = useState(false);
  const [activeDragMachine, setActiveDragMachine] = useState(null);
  const [activeDragSegment, setActiveDragSegment] = useState(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState(() => new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const [bulkPrintAssets, setBulkPrintAssets] = useState([]);
  const bulkPrintCleanupTimer = useRef(null);
  const bulkPrintAfterprintHandler = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const [sidebarDragActive, setSidebarDragActive] = useState(false);
  const [segmentSaving, setSegmentSaving] = useState(false);
  const [serviceOrderSaving, setServiceOrderSaving] = useState(false);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [systemMode, setSystemMode] = useState(readSystemMode);
  const [alertPrioritySettings, setAlertPrioritySettings] = useState(() => normalizePrioritySettings());
  const [alertPriorityColors, setAlertPriorityColors] = useState(defaultPriorityColors);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const canViewDashboard = hasPermission(user, "dashboard.view");
  const canViewAlerts = hasPermission(user, "alerts.view");
  const canViewScripts = hasPermission(user, "scripts.view");
  const canViewPreventivePlans = hasPermission(user, "preventive_plans.view");
  const canViewPreventiveAutomation = hasPermission(user, "preventive_automation.view");
  const canViewInventory = hasPermission(user, "inventory.view");
  const canViewMachine = hasPermission(user, "inventory.view_machine");
  const canViewServiceOrders = hasPermission(user, "service_orders.view");
  const canOpenGeneralSettings =
    hasPermission(user, "settings.view") ||
    hasPermission(user, "settings.appearance") ||
    hasPermission(user, "settings.system_mode") ||
    hasPermission(user, "admin.full");
  const permittedViewIds = useMemo(() => {
    const views = [];
    if (canViewDashboard) views.push("dashboard");
    if (canViewAlerts || canViewScripts || canViewPreventivePlans || canViewPreventiveAutomation) views.push("alerts");
    if (canViewServiceOrders) views.push("service-orders");
    if (canViewInventory) views.push("inventory");
    return views;
  }, [canViewAlerts, canViewDashboard, canViewInventory, canViewPreventiveAutomation, canViewPreventivePlans, canViewScripts, canViewServiceOrders]);
  const canConfigureAlerts = hasPermission(user, "alerts.configure");
  const canConfigureAlertPrioritySettings = hasPermission(user, "alerts.configure");
  const canCommentAlerts = hasPermission(user, "alerts.comment");
  const canManageAlertSuggestions =
    hasPermission(user, "alerts.manage_suggestions") &&
    hasPermission(user, "service_orders.create_from_alert");
  const canManageScripts = hasPermission(user, "scripts.manage");
  const canRegisterScriptSimulation = hasPermission(user, "scripts.register_simulation");
  const canUseScriptsFromAlerts = hasPermission(user, "scripts.use_from_alert");
  const canViewScriptLogs = hasPermission(user, "script_logs.view");
  const canResolveScriptLogs = hasPermission(user, "script_logs.resolve");
  const canManageScriptValidations = hasPermission(user, "script_validations.manage");
  const canCreatePreventivePlans =
    hasPermission(user, "preventive_plans.create") &&
    hasPermission(user, "preventive_plans.prepare");
  const canCreatePreventiveServiceOrder =
    hasPermission(user, "preventive_plans.prepare") &&
    hasPermission(user, "service_orders.create");
  const canCreatePreventiveAutomation = hasPermission(user, "preventive_automation.create");
  const canUpdatePreventiveAutomation = hasPermission(user, "preventive_automation.update");
  const canDisablePreventiveAutomation = hasPermission(user, "preventive_automation.disable");
  const canPreparePreventiveAutomation = hasPermission(user, "preventive_automation.run_prepare");
  const canManageInventory =
    hasPermission(user, "inventory.create_asset") ||
    hasPermission(user, "inventory.edit_asset") ||
    hasPermission(user, "inventory.move_assets") ||
    hasPermission(user, "inventory.manage_segments");
  const sidebarWasCollapsedBeforeDrag = useRef(true);
  const sidebarAutoCloseTimer = useRef(null);
  const dragStartScrollY = useRef(0);

  useEffect(() => {
    if (permittedViewIds.includes(activeView)) return;
    setActiveView(permittedViewIds[0] || "blocked");
  }, [activeView, permittedViewIds]);

  useEffect(() => {
    return () => {
      window.clearTimeout(sidebarAutoCloseTimer.current);
      window.clearTimeout(bulkPrintCleanupTimer.current);
      if (bulkPrintAfterprintHandler.current) {
        window.removeEventListener("afterprint", bulkPrintAfterprintHandler.current);
      }
      document.body.classList.remove("qr-print-mode", "bulk-qr-print-mode");
    };
  }, []);

  function saveInventoryTabs(updater) {
    const nextTabs = typeof updater === "function" ? updater(inventoryTabs) : updater;
    const normalized = normalizeInventoryTabs(nextTabs);
    localStorage.setItem(inventoryTabsKey, JSON.stringify(normalized));
    setInventoryTabs(normalized);
  }

  function saveInventoryTabMeta(updater) {
    setInventoryTabMeta((current) => {
      const next = normalizeInventoryTabMeta(typeof updater === "function" ? updater(current) : updater);
      localStorage.setItem(inventoryTabMetaKey, JSON.stringify(next));
      return next;
    });
  }

  function saveMaintenanceRecords(updater) {
    setMaintenanceRecords((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      localStorage.setItem(maintenanceRecordsKey, JSON.stringify(next));
      return next;
    });
  }

  async function changeSystemMode(mode) {
    const nextMode = mode === "business" ? "business" : "local";
    setSystemMode(nextMode);

    try {
      const response = await updateSystemSettings(token, { systemMode: nextMode });
      const savedMode = response.settings?.systemMode === "business" ? "business" : "local";
      setSystemMode(savedMode);
      notify(savedMode === "business" ? "Modo Business ativado." : "Modo Local ativado.", "ok");
    } catch (error) {
      setSystemMode(systemMode);
      notify(error.message, "danger");
    }
  }

  function updateInventoryMeta(kind, id, updates) {
    if (!id) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      [kind]: {
        ...(current[kind] || {}),
        [id]: {
          ...(current[kind]?.[id] || {}),
          ...updates
        }
      }
    }));
  }

  function updateDeviceTabOwnership(deviceIds, targetSegment, targetTabId = activeInventoryTab.id) {
    const ids = Array.isArray(deviceIds) ? deviceIds : [deviceIds];
    const targetIsDefault = Boolean(targetSegment?.isDefault);

    saveInventoryTabMeta((current) => {
      const nextDevices = { ...(current.devices || {}) };

      for (const id of ids.filter(Boolean)) {
        const currentMeta = { ...(nextDevices[id] || {}) };

        if (targetIsDefault) {
          delete currentMeta.tabId;
          if (Object.keys(currentMeta).length) {
            nextDevices[id] = currentMeta;
          } else {
            delete nextDevices[id];
          }
        } else {
          nextDevices[id] = {
            ...currentMeta,
            tabId: targetTabId
          };
        }
      }

      return {
        ...current,
        devices: nextDevices
      };
    });
  }

  const alertTrend = useMemo(() => {
    return history.slice(0, 6).reverse().map((alert, index) => ({
      label: `#${index + 1}`,
      critical: alert.severity === "critical" ? 1 : 0,
      warning: alert.severity === "warning" ? 1 : 0
    }));
  }, [history]);
  const fallbackInventoryTabId = inventoryTabs[0]?.id || defaultInventoryTab.id;
  const activeInventoryTab = inventoryTabs.find((tab) => tab.id === activeInventoryTabId) || inventoryTabs[0] || defaultInventoryTab;
  const itemTabId = (kind, id) => inventoryTabMeta[kind]?.[id]?.tabId || fallbackInventoryTabId;
  const itemOrder = (kind, id, fallback) => {
    const order = inventoryTabMeta[kind]?.[id]?.order;
    return Number.isFinite(order) ? order : fallback;
  };
  const decoratedSegmentGroups = useMemo(
    () =>
      segmentGroups
        .map((group, index) => ({
          ...group,
          tabId: itemTabId("groups", group.id),
          order: itemOrder("groups", group.id, index)
        }))
        .sort((left, right) => left.order - right.order),
    [fallbackInventoryTabId, inventoryTabMeta, segmentGroups]
  );
  const decoratedSegments = useMemo(
    () =>
      segments
        .map((segment, index) => ({
          ...segment,
          tabId: segment.isDefault ? "shared" : itemTabId("segments", segment.id),
          order: itemOrder("segments", segment.id, index)
        }))
        .sort((left, right) => left.order - right.order),
    [fallbackInventoryTabId, inventoryTabMeta, segments]
  );
  const defaultSegmentIds = useMemo(
    () => new Set(decoratedSegments.filter((segment) => segment.isDefault).map((segment) => segment.id)),
    [decoratedSegments]
  );
  const decoratedAllDevices = useMemo(
    () =>
      allDevices.map((device, index) => {
        const isAvailableBackup = Boolean(device.isBackup) && device.backupStatus !== "in_use";
        const rawSegmentId = device.segmentId;
        const rawSegmentName = device.segmentName;
        const isGlobalUnorganized = !isAvailableBackup && defaultSegmentIds.has(rawSegmentId);

        return {
          ...device,
          backupRealSegmentId: device.backupOriginalSegmentId || rawSegmentId,
          backupRealSegmentName: device.backupOriginalSegmentName || rawSegmentName,
          segmentId: isAvailableBackup ? backupSegmentId : rawSegmentId,
          segmentName: isAvailableBackup ? backupSegmentName : rawSegmentName,
          tabId: isAvailableBackup
            ? "global-backup"
            : isGlobalUnorganized
              ? "global-unorganized"
              : itemTabId("devices", device.id),
          isGlobalBackup: isAvailableBackup,
          isGlobalUnorganized,
          order: itemOrder("devices", device.id, index)
        };
      }),
    [allDevices, defaultSegmentIds, fallbackInventoryTabId, inventoryTabMeta]
  );
  const activeAllDevices = useMemo(
    () => decoratedAllDevices.filter((device) => device.isGlobalBackup || device.isGlobalUnorganized || device.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedAllDevices]
  );
  const activeMaintenanceSegmentIds = useMemo(
    () => {
      const next = new Set(
        activeAllDevices
          .filter((device) => device.maintenance || isMaintenanceSegmentName(device.segmentName))
          .map((device) => device.segmentId)
          .filter(Boolean)
      );

      for (const segment of decoratedSegments) {
        if (
          !segment.isDefault &&
          segment.tabId === activeInventoryTab.id &&
          isMaintenanceSegmentName(segment.name) &&
          Number(segment.machineCount || 0) > 0
        ) {
          next.add(segment.id);
        }
      }

      return next;
    },
    [activeAllDevices, activeInventoryTab.id, decoratedSegments]
  );
  const activeSegmentGroups = useMemo(
    () => decoratedSegmentGroups.filter((group) => group.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedSegmentGroups]
  );
  const activeSegments = useMemo(() => {
    const activeNonDefaultSegments = decoratedSegments.filter(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === activeInventoryTab.id &&
        (!isMaintenanceSegmentName(segment.name) || activeMaintenanceSegmentIds.has(segment.id))
    );
    const sharedDefaultSegments = decoratedSegments.filter((segment) => segment.isDefault);
    const backupSegment = decoratedAllDevices.some((device) => device.isBackup)
      ? [{
          id: backupSegmentId,
          name: backupSegmentName,
          color: "#f59e0b",
          isDefault: true,
          isBackupSegment: true,
          tabId: "shared",
          order: -1
        }]
      : [];

    return [...backupSegment, ...sharedDefaultSegments, ...activeNonDefaultSegments];
  }, [activeInventoryTab.id, activeMaintenanceSegmentIds, decoratedAllDevices, decoratedSegments]);
  const activeSegmentById = useMemo(
    () => new Map(activeSegments.map((segment) => [segment.id, segment])),
    [activeSegments]
  );
  const activeGroupById = useMemo(
    () => new Map(activeSegmentGroups.map((group) => [group.id, group])),
    [activeSegmentGroups]
  );
  const filteredInventoryDevices = useMemo(() => activeAllDevices.filter((device) => {
    const term = inventorySearch.trim().toLowerCase();
    if (!term) return true;
    const segment = activeSegmentById.get(device.segmentId);
    const group = segment?.groupId ? activeGroupById.get(segment.groupId) : null;

    return [
      device.name,
      machineAliases[device.id],
      device.ip,
      device.statusLabel,
      device.segmentName,
      segment?.name,
      group?.name,
      device.assetType,
      device.type,
      device.source,
      device.manualAsset?.brand,
      device.manualAsset?.model,
      device.manualAsset?.assetTag,
      device.manualAsset?.macAddress,
      device.manualAsset?.hostname,
      device.manualAsset?.location,
      device.hardware?.os,
      device.hardware?.manufacturer,
      device.hardware?.model,
      device.hardware?.assetTag,
      device.hardware?.serialNumber,
      device.hardware?.macAddress,
      device.hardware?.software?.join(" ")
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  }), [activeAllDevices, activeGroupById, activeSegmentById, inventorySearch, machineAliases]);
  const selectedAssets = useMemo(
    () => activeAllDevices.filter((device) => selectedAssetIds.has(device.id)),
    [activeAllDevices, selectedAssetIds]
  );
  const {
    handleDragEnd: handleInventoryDragEnd,
    machinesBySegment,
    sensors
  } = useInventoryDragAndDrop({
    devices: activeAllDevices,
    filteredDevices: filteredInventoryDevices,
    segments: activeSegments,
    selectedAssetIds,
    onMoveMachine: handleMoveMachine,
    onMoveMachines: handleMoveMachines
  });

  useEffect(() => {
    const visibleIds = new Set(filteredInventoryDevices.map((device) => device.id));

    setSelectedAssetIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));

      if (next.size === current.size) return current;
      if (next.size < 2) setBulkMoveTarget("");
      return next;
    });
  }, [filteredInventoryDevices]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [
        deviceData,
        allDeviceData,
        segmentData,
        groupData,
        activeAlertData,
        alertHistoryData,
        alertCorrelationData,
        alertRuleData,
        suggestionData,
        maintenanceScriptData,
        preventivePlanData,
        preventiveAutomationData,
        serviceOrderData,
        alertSettingsData,
        systemSettingsData
      ] = await Promise.all([
        canViewInventory ? fetchDevices(token, { search, status }) : Promise.resolve({ devices: [], summary: null }),
        canViewInventory ? fetchDevices(token) : Promise.resolve({ devices: [] }),
        canViewInventory ? fetchSegments(token) : Promise.resolve({ segments: [] }),
        canViewInventory ? fetchSegmentGroups(token) : Promise.resolve({ groups: [] }),
        canViewAlerts ? fetchAlerts(token) : Promise.resolve({ alerts: [] }),
        canViewAlerts ? fetchAlertHistory(token) : Promise.resolve({ alerts: [] }),
        canViewAlerts ? fetchAlertCorrelations(token).catch(() => ({ correlations: [] })) : Promise.resolve({ correlations: [] }),
        canViewAlerts ? fetchAlertRules(token) : Promise.resolve({ rules: [] }),
        canViewAlerts ? fetchServiceOrderSuggestions(token) : Promise.resolve({ suggestions: [] }),
        canViewScripts ? fetchMaintenanceScripts(token) : Promise.resolve({ scripts: [] }),
        canViewPreventivePlans ? fetchPreventivePlans(token) : Promise.resolve({ preventivePlans: [] }),
        canViewPreventiveAutomation ? fetchPreventiveAutomationPlans(token) : Promise.resolve({ preventiveAutomationPlans: [] }),
        canViewServiceOrders ? fetchServiceOrders(token) : Promise.resolve({ serviceOrders: [] }),
        canViewAlerts
          ? fetchAlertSettings(token).catch(() => ({ settings: normalizePrioritySettings() }))
          : Promise.resolve({ settings: normalizePrioritySettings() }),
        fetchSystemSettings(token).catch(() => ({ settings: { systemMode } }))
      ]);

      const nextMaintenanceRecords = { ...maintenanceRecords };
      let maintenanceRecordsChanged = false;

      for (const device of allDeviceData.devices) {
        if (
          nextMaintenanceRecords[device.id]?.active &&
          !isMaintenanceSegmentName(device.segmentName)
        ) {
          delete nextMaintenanceRecords[device.id];
          maintenanceRecordsChanged = true;
        }
      }

      if (maintenanceRecordsChanged) {
        setMaintenanceRecords(nextMaintenanceRecords);
        localStorage.setItem(maintenanceRecordsKey, JSON.stringify(nextMaintenanceRecords));
      }
      const nextDevices = applyInventoryLocalState(deviceData.devices, removedPeripherals, peripheralHistory, nextMaintenanceRecords);
      const nextAllDevices = applyInventoryLocalState(allDeviceData.devices, removedPeripherals, peripheralHistory, nextMaintenanceRecords);
      const nextGroups = groupData.groups || [];
      const nextSegments = applySegmentGroups(segmentData.segments, nextGroups);
      setDevices(nextDevices);
      setAllDevices(nextAllDevices);
      setSegmentGroups(nextGroups);
      setSegments(nextSegments);
      setSummary(deviceData.summary);
      setAlerts(activeAlertData.alerts);
      setHistory(alertHistoryData.alerts);
      setAlertCorrelations(alertCorrelationData.correlations || []);
      setAlertRules(alertRuleData.rules || []);
      setServiceOrderSuggestions(suggestionData.suggestions || []);
      setMaintenanceScripts(maintenanceScriptData.scripts || []);
      setPreventivePlans(preventivePlanData.preventivePlans || []);
      setPreventiveAutomationPlans(preventiveAutomationData.preventiveAutomationPlans || []);
      setServiceOrders(serviceOrderData.serviceOrders || []);
      const nextPrioritySettings = normalizePrioritySettings(alertSettingsData.settings);
      setAlertPrioritySettings(nextPrioritySettings);
      setAlertPriorityColors(nextPrioritySettings.priorityColors);
      if (systemSettingsData.settings?.systemMode) {
        const nextMode = systemSettingsData.settings.systemMode === "business" ? "business" : "local";
        setSystemMode(nextMode);
      }
      setLastUpdated(new Date());

      const visibleForSelection = activeView === "dashboard" ? deviceData.devices : allDeviceData.devices;
      const selectedStillVisible = visibleForSelection.some((device) => device.id === selectedId);
      const nextId = selectedStillVisible ? selectedId : visibleForSelection[0]?.id;
      setSelectedId(nextId);
      if (nextId && canViewMachine) {
        try {
          const details = await fetchDevice(token, nextId);
          setSelectedDevice(details.device);
        } catch {
          setSelectedDevice(null);
        }
      } else {
        setSelectedDevice(null);
      }

      if (
        !silent &&
        activeAlertData.alerts.some((alert) => alert.severity === "critical")
      ) {
        notify("Existem avisos críticos pendentes.", "danger");
      }
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, status]);

  useEffect(() => {
    const timer = setInterval(() => loadData(true), 15000);
    return () => clearInterval(timer);
  }, [search, status]);

  useEffect(() => {
    if (!inventoryTabs.some((tab) => tab.id === activeInventoryTabId)) {
      setActiveInventoryTabId(fallbackInventoryTabId);
    }
  }, [activeInventoryTabId, fallbackInventoryTabId, inventoryTabs]);

  useEffect(() => {
    localStorage.setItem(activeInventoryTabKey, activeInventoryTab.id);
    setSelectedInventoryGroup("all");
    setSelectedInventorySegment("all");
    setInventorySearch("");
    clearAssetSelection();
  }, [activeInventoryTab.id]);

  useEffect(() => {
    const socket = createMonitoringSocket(token);

    if (!socket) return undefined;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "monitoring.snapshot") return;

        setSummary(payload.summary);
        setAlerts(payload.alerts);
        setLastUpdated(new Date(payload.updatedAt));
        setAllDevices(payload.devices);
        if (payload.segments) {
          setSegments(applySegmentGroups(payload.segments, segmentGroups));
        }

        if (!search && !status) {
          setDevices(payload.devices);
          setSelectedDevice((current) => {
            if (!current) return current;
            return payload.devices.find((device) => device.id === current.id) || current;
          });
        }
      } catch (_error) {
        notify("Não foi possível processar o streaming em tempo real.", "danger");
      }
    };

    socket.onclose = (event) => {
      if (event.code === 1008) {
        notify("Sessão de streaming não autorizada.", "danger");
        logout();
      }
    };

    return () => socket.close();
  }, [token, search, status, segmentGroups]);

  useEffect(() => {
    if (selectedInventorySegment === "all") return;

    const segment = activeSegments.find((item) => item.id === selectedInventorySegment);

    if (!segment) {
      setSelectedInventorySegment("all");
    }
  }, [activeSegments, selectedInventorySegment]);

  useEffect(() => {
    if (selectedInventoryGroup === "all" || selectedInventoryGroup === "ungrouped") return;

    if (!activeSegmentGroups.some((group) => group.id === selectedInventoryGroup)) {
      setSelectedInventoryGroup("all");
      setSelectedInventorySegment("all");
    }
  }, [activeSegmentGroups, selectedInventoryGroup]);

  function selectInventoryGroup(groupId) {
    setSelectedInventoryGroup(groupId);
    setSelectedInventorySegment("all");
  }

  function selectInventorySegment(segmentId) {
    setSelectedInventorySegment(segmentId);

    if (segmentId === "all") {
      setSelectedInventoryGroup("all");
      return;
    }

    const segment = activeSegments.find((item) => item.id === segmentId);
    if (segment) {
      setSelectedInventoryGroup(segment.groupId || "ungrouped");
    }
  }

  async function selectDevice(id) {
    setSelectedId(id);
    const details = await fetchDevice(token, id);
    setSelectedDevice(details.device);
  }

  async function handleAcknowledge(alertId) {
    try {
      await acknowledgeAlert(token, alertId, "Resolvido pelo dashboard");
      notify("Alerta marcado como resolvido.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleRemoveAcknowledgement(alertId) {
    try {
      await removeAlertAcknowledgement(token, alertId);
      notify("Status resolvido removido.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleEvaluateAlerts() {
    try {
      const result = await evaluateAlerts(token);
      setAlerts(result.alerts || []);
      setAlertRules(result.rules || []);
      setServiceOrderSuggestions(result.suggestions || []);
      const correlationData = await fetchAlertCorrelations(token).catch(() => ({ correlations: [] }));
      setAlertCorrelations(correlationData.correlations || []);
      const created = result.createdSuggestions?.length || 0;
      notify(
        created
          ? `${created} sugestão(ões) de OS criada(s) a partir dos avisos.`
          : "Avisos avaliados. Nenhuma nova sugestão foi necessária.",
        "ok"
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAcceptSuggestion(suggestionId) {
    try {
      const acceptedSuggestion = serviceOrderSuggestions.find((suggestion) => suggestion.id === suggestionId);
      const result = await acceptServiceOrderSuggestion(token, suggestionId);
      const serviceOrder = result.serviceOrder;
      const assetId = serviceOrder?.assetId || acceptedSuggestion?.assetId;
      const linkedMachine = assetId
        ? allDevices.find((device) => String(device.id) === String(assetId))
        : null;

      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));

      if (linkedMachine && serviceOrder?.id) {
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, serviceOrder);
      }

      notify(`OS criada a partir do aviso: ${serviceOrder?.number || "registrada"}.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleAddAlertComment(alertId, message) {
    try {
      await createAlertComment(token, alertId, message);
      notify("Comentário registrado no aviso.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleRejectSuggestion(suggestionId) {
    const reason = "Recusado pelo painel de avisos.";
    try {
      await rejectServiceOrderSuggestion(token, suggestionId, reason);
      setServiceOrderSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
      notify("Sugestão de OS recusada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleUpdateAlertRule(ruleId, payload) {
    try {
      const response = await updateAlertRule(token, ruleId, payload);
      setAlertRules((current) =>
        current.map((rule) => (rule.id === ruleId ? response.rule : rule))
      );
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleSaveAlertPrioritySettings(settings) {
    try {
      const response = await updateAlertSettings(token, settings);
      const nextPrioritySettings = normalizePrioritySettings(response.settings);
      setAlertPrioritySettings(nextPrioritySettings);
      setAlertPriorityColors(nextPrioritySettings.priorityColors);
      notify("Configurações de prioridade dos avisos salvas.", "ok");
      return nextPrioritySettings;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleAnalyzeMaintenanceScript(payload) {
    try {
      const response = await analyzeMaintenanceScript(token, payload);
      notify("Resumo estimado gerado. Revise manualmente antes de salvar.", "ok");
      return response.analysis;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSaveMaintenanceScript(payload, scriptId = null) {
    try {
      const response = scriptId
        ? await updateMaintenanceScript(token, scriptId, payload)
        : await createMaintenanceScript(token, payload);
      setMaintenanceScripts((current) => {
        const exists = current.some((script) => script.id === response.script.id);
        return exists
          ? current.map((script) => (script.id === response.script.id ? response.script : script))
          : [response.script, ...current];
      });
      notify(scriptId ? "Script de manutenção atualizado." : "Script de manutenção cadastrado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDeactivateMaintenanceScript(scriptId) {
    try {
      const response = await deleteMaintenanceScript(token, scriptId);
      setMaintenanceScripts((current) =>
        current.map((script) => (script.id === response.script.id ? response.script : script))
      );
      notify("Script de manutenção desativado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleRegisterMaintenanceScriptSimulation(scriptId, payload) {
    try {
      await registerMaintenanceScriptSimulation(token, scriptId, payload);
      notify("Registro criado. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleUseSuggestionScript(suggestionId, scriptId, payload) {
    try {
      await useSuggestionScript(token, suggestionId, scriptId, payload);
      notify("Validacao registrada. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleAcknowledgeScriptLog(logId) {
    try {
      await acknowledgeScriptLog(token, logId);
      notify("Log marcado como revisado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleApplyScriptLogSuggestedSolution(logId, payload) {
    try {
      await applyScriptLogSuggestedSolution(token, logId, payload);
      notify("Acao corretiva registrada. Nenhum comando foi executado.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCancelScriptValidation(validationId) {
    try {
      await cancelScriptValidation(token, validationId);
      notify("Validacao cancelada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCreatePreventivePlan(payload) {
    try {
      const response = await createPreventivePlan(token, payload);
      setPreventivePlans((current) => [
        response.preventivePlan,
        ...current.filter((plan) => plan.id !== response.preventivePlan.id)
      ]);
      notify("Preventiva registrada. Nenhum comando foi executado.", "ok");
      await loadData(true);
      return response.preventivePlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCreatePreventivePlanServiceOrder(planId) {
    try {
      const response = await createPreventivePlanServiceOrder(token, planId);
      setPreventivePlans((current) =>
        current.map((plan) => (plan.id === response.preventivePlan.id ? response.preventivePlan : plan))
      );
      setServiceOrders((current) => [
        response.serviceOrder,
        ...current.filter((order) => order.id !== response.serviceOrder.id)
      ]);
      notify(`OS preventiva ${response.serviceOrder.number} criada.`, "ok");
      await loadData(true);
      return response;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleSavePreventiveAutomationPlan(planId, payload) {
    try {
      const response = planId
        ? await updatePreventiveAutomationPlan(token, planId, payload)
        : await createPreventiveAutomationPlan(token, payload);
      setPreventiveAutomationPlans((current) => {
        const exists = current.some((plan) => plan.id === response.preventiveAutomationPlan.id);
        return exists
          ? current.map((plan) => (plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan))
          : [response.preventiveAutomationPlan, ...current];
      });
      notify(planId ? "Automação preventiva atualizada." : "Automação preventiva criada.", "ok");
      await loadData(true);
      return response.preventiveAutomationPlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleDisablePreventiveAutomationPlan(planId) {
    try {
      const response = await disablePreventiveAutomationPlan(token, planId);
      setPreventiveAutomationPlans((current) =>
        current.map((plan) => (plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan))
      );
      notify("Automação preventiva desativada.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handlePreparePreventiveAutomationPlan(planId) {
    try {
      const response = await preparePreventiveAutomationPlan(token, planId);
      setPreventiveAutomationPlans((current) =>
        current.map((plan) =>
          plan.id === response.preventiveAutomationPlan.id ? response.preventiveAutomationPlan : plan
        )
      );
      notify("Rotina preventiva preparada. Nenhum comando foi executado.", "ok");
      await loadData(true);
      return response;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  function getServiceOrderModeError(payload) {
    const title = payload?.title?.trim() || "";
    const description = payload?.description?.trim() || "";
    const category = payload?.category?.trim() || "";
    const requesterName = payload?.requesterName?.trim() || "";

    if (title.length < 3) return "Informe um titulo com pelo menos 3 caracteres.";

    if (systemMode === "business") {
      if (!payload?.environmentId) {
        return "No modo Business, selecione um cliente para abrir a Ordem de Serviço.";
      }
      if (!payload?.assetId) return "No modo Business, vincule uma máquina/ativo à OS.";
      if (!requesterName) return "No modo Business, informe o solicitante.";
      if (!category) return "No modo Business, informe a categoria da OS.";
      if (!description) return "No modo Business, descreva a solicitacao.";
    }

    if (systemMode !== "business") {
      if (!description) return "Informe as observações do problema.";
      if (!category) return "Informe a categoria da OS.";
      if (!requesterName) return "Informe o solicitante.";
    }

    return "";
  }

  function findDecoratedDevice(deviceId) {
    return decoratedAllDevices.find((device) => device.id === deviceId) ||
      allDevices.find((device) => device.id === deviceId) ||
      devices.find((device) => device.id === deviceId);
  }

  function addServiceOrderHistoryToState(orderId, event) {
    if (!event) return;

    setServiceOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, history: [event, ...(order.history || [])] } : order
      )
    );
  }

  async function addServiceOrderSystemHistory(orderId, payload) {
    try {
      const response = await addServiceOrderHistory(token, orderId, payload);
      addServiceOrderHistoryToState(orderId, response.event);
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  async function handleCreateServiceOrder(payload) {
    const modeError = getServiceOrderModeError(payload);
    if (modeError) {
      notify(modeError, "danger");
      return null;
    }

    setServiceOrderSaving(true);
    try {
      const response = await createServiceOrder(token, payload);
      setServiceOrders((current) => [response.serviceOrder, ...current]);
      if (response.serviceOrder.assetId) {
        const linkedMachine = findDecoratedDevice(response.serviceOrder.assetId);
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, response.serviceOrder);
      }
      notify(`Ordem ${response.serviceOrder.number} criada.`, "ok");
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleUpdateServiceOrder(id, payload) {
    setServiceOrderSaving(true);
    try {
      const previousOrder = serviceOrders.find((order) => order.id === id);
      const response = await updateServiceOrder(token, id, payload);
      setServiceOrders((current) =>
        current.map((order) => (order.id === id ? response.serviceOrder : order))
      );
      if (payload.assetId && payload.assetId !== previousOrder?.assetId) {
        const linkedMachine = findDecoratedDevice(payload.assetId);
        await ensureMachineInMaintenanceForServiceOrder(linkedMachine, response.serviceOrder);
      }
      notify("Ordem de Serviço atualizada.", "ok");
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleAddServiceOrderHistory(id, payload) {
    try {
      const response = await addServiceOrderHistory(token, id, payload);
      setServiceOrders((current) =>
        current.map((order) =>
          order.id === id ? { ...order, history: [response.event, ...(order.history || [])] } : order
        )
      );
      notify("Registro adicionado ao historico.", "ok");
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  async function handleDeleteServiceOrder(order) {
    if (!order) return false;

    if (order.backupAssetId) {
      notify("Esta OS possui uma máquina Backup em uso. Devolva o Backup ou finalize a OS antes de excluir.", "danger");
      return false;
    }

    const linkedMachine = findDecoratedDevice(order.assetId);
    if (linkedMachine && (linkedMachine.maintenance || isMaintenanceSegmentName(linkedMachine.segmentName))) {
      notify("Esta OS possui uma máquina em manutenção. Finalize a OS ou retire a máquina da manutenção antes de excluir.", "danger");
      return false;
    }

    setServiceOrderSaving(true);
    try {
      await deleteServiceOrder(token, order.id);
      setServiceOrders((current) => current.filter((item) => item.id !== order.id));
      notify(`Ordem ${order.number} excluida.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  function isMaintenanceServiceOrder(order) {
    return (
      Boolean(order?.assetId) &&
      String(order?.category || "").trim().toLowerCase() === "manutencao"
    );
  }

  async function handleChangeServiceOrderStatus(order, statusValue) {
    if (!order || order.status === statusValue) return order;

    setServiceOrderSaving(true);
    try {
      const response = await updateServiceOrderStatus(token, order.id, statusValue);
      setServiceOrders((current) =>
        current.map((item) => (item.id === order.id ? response.serviceOrder : item))
      );
      notify("Status da OS atualizado.", "ok");

      if (response.serviceOrder.closedAt && response.serviceOrder.backupAssetId) {
        await releaseBackupForServiceOrder(response.serviceOrder, { finalized: true });
      }

      if (response.serviceOrder.closedAt && response.serviceOrder.assetId) {
        const asset = findDecoratedDevice(response.serviceOrder.assetId);

        if (asset && (asset.maintenance || isMaintenanceSegmentName(asset.segmentName))) {
          const removedFromMaintenance = await removeMachineFromMaintenance(asset, { serviceOrder: response.serviceOrder });
          if (removedFromMaintenance) {
            await addServiceOrderSystemHistory(response.serviceOrder.id, {
              eventType: "maintenance",
              message: "OS finalizada e máquina retirada da manutenção.",
              oldValue: asset.segmentName || "Manutenção"
            });
          }
        }
      }

      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  function updateDeviceSegmentInState(deviceId, segmentId, segmentName, extra = {}) {
    const update = (device) =>
      device.id === deviceId ? { ...device, segmentId, segmentName, ...extra } : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === deviceId ? update(current) : current));
  }

  async function handleMoveMachine(machine, segmentId, options = {}) {
    if (!machine || !segmentId || machine.segmentId === segmentId) {
      setMoveModal(null);
      return false;
    }

    if (segmentId === backupSegmentId) {
      notify("Use a ação Backup para enviar máquinas para a área de reserva.", "danger");
      return false;
    }

    if (machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove) {
      notify("Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.", "danger");
      return false;
    }

    if (!options.forceSingle && selectedAssetIds.has(machine.id) && selectedAssetIds.size > 1) {
      return handleMoveMachines(Array.from(selectedAssetIds), segmentId, options);
    }

    const target =
      activeSegments.find((segment) => segment.id === segmentId) ||
      decoratedSegments.find((segment) => segment.id === segmentId) ||
      segments.find((segment) => segment.id === segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino invalido.", "danger");
      return false;
    }
    const previousSegment = { id: machine.segmentId, name: machine.segmentName };

    updateDeviceTabOwnership(machine.id, target, options.targetTabId);
    updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento", options.reason === "maintenance" ? { maintenance: true } : {});
    setMoveModal(null);

    try {
      const response = await updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {});
      updateDeviceSegmentInState(
        machine.id,
        response.device.segmentId,
        response.device.segmentName,
        options.reason === "maintenance" ? { maintenance: true } : {}
      );
      notify(`${machine.name} movida para ${response.device.segmentName}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      updateDeviceTabOwnership(
        machine.id,
        activeSegments.find((segment) => segment.id === previousSegment.id) ||
          decoratedSegments.find((segment) => segment.id === previousSegment.id) ||
          segments.find((segment) => segment.id === previousSegment.id),
        machine.tabId
      );
      updateDeviceSegmentInState(machine.id, previousSegment.id, previousSegment.name);
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleMoveMachines(machineIds, segmentId, options = {}) {
    if (!machineIds.length || !segmentId) return false;

    if (segmentId === backupSegmentId) {
      notify("Use a ação Backup para enviar máquinas para a área de reserva.", "danger");
      return false;
    }

    const target =
      activeSegments.find((segment) => segment.id === segmentId) ||
      decoratedSegments.find((segment) => segment.id === segmentId) ||
      segments.find((segment) => segment.id === segmentId);
    if (!target || target.isBackupSegment) {
      notify("Segmento de destino invalido.", "danger");
      return false;
    }
    const machinesToMove = activeAllDevices.filter(
      (device) => machineIds.includes(device.id) && device.segmentId !== segmentId
    );
    const blockedBackup = machinesToMove.find((machine) => machine.isBackup && machine.backupStatus !== "in_use" && !options.allowBackupMove);

    if (blockedBackup) {
      notify("Máquinas Backup disponíveis só podem ser alocadas temporariamente por uma OS.", "danger");
      return false;
    }

    if (!machinesToMove.length) {
      clearAssetSelection();
      return false;
    }

    const previous = new Map(machinesToMove.map((machine) => [
      machine.id,
      { id: machine.segmentId, name: machine.segmentName }
    ]));

    updateDeviceTabOwnership(machinesToMove.map((machine) => machine.id), target, options.targetTabId);
    machinesToMove.forEach((machine) => {
      updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    });
    setMoveModal(null);

    try {
      await Promise.all(
        machinesToMove.map((machine) =>
          updateDeviceSegment(token, machine.id, segmentId, options.reason ? { reason: options.reason } : {})
        )
      );
      notify(`${machinesToMove.length} equipamentos movidos para ${target?.name || "Segmento"}.`, "ok");
      await loadData(true);
      clearAssetSelection();
      return true;
    } catch (error) {
      machinesToMove.forEach((machine) => {
        const fallback = previous.get(machine.id);
        updateDeviceTabOwnership(
          machine.id,
          activeSegments.find((segment) => segment.id === fallback.id) ||
            decoratedSegments.find((segment) => segment.id === fallback.id) ||
            segments.find((segment) => segment.id === fallback.id),
          machine.tabId
        );
        updateDeviceSegmentInState(machine.id, fallback.id, fallback.name);
      });
      notify(error.message, "danger");
      return false;
    }
  }

  function handleSelectAsset(machine, { additive = false } = {}) {
    setSelectedAssetIds((current) => {
      const next = additive ? new Set(current) : new Set();

      if (additive && next.has(machine.id)) {
        next.delete(machine.id);
      } else {
        next.add(machine.id);
      }

      return next;
    });
  }

  function toggleAssetSelection(machineId) {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  }

  function clearAssetSelection() {
    setSelectedAssetIds(new Set());
    setBulkMoveTarget("");
  }

  function handleBulkMove() {
    if (!bulkMoveTarget || !selectedAssetIds.size) return;
    handleMoveMachines(Array.from(selectedAssetIds), bulkMoveTarget);
  }

  function finishBulkPrint() {
    document.body.classList.remove("qr-print-mode", "bulk-qr-print-mode");
    setBulkPrintAssets([]);
    window.clearTimeout(bulkPrintCleanupTimer.current);
    if (bulkPrintAfterprintHandler.current) {
      window.removeEventListener("afterprint", bulkPrintAfterprintHandler.current);
      bulkPrintAfterprintHandler.current = null;
    }
  }

  function handleBulkPrint() {
    if (!selectedAssets.length) return;

    finishBulkPrint();
    setBulkPrintAssets(selectedAssets);
    document.body.classList.add("qr-print-mode", "bulk-qr-print-mode");
    bulkPrintAfterprintHandler.current = finishBulkPrint;
    window.addEventListener("afterprint", bulkPrintAfterprintHandler.current);
  }

  function handleBulkPrintReady() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        bulkPrintCleanupTimer.current = window.setTimeout(finishBulkPrint, 1800);
      });
    });
  }

  async function handleToggleBackup(machine, desiredState) {
    if (!machine) return false;

    if (machine.backupStatus === "in_use" && desiredState === false) {
      notify("Esta máquina Backup está em uso por uma OS. Devolva ou finalize a OS antes de remover o Backup.", "danger");
      return false;
    }

    const nextIsBackup = desiredState ?? !machine.isBackup;
    const originalSegmentId =
      machine.backupRealSegmentId ||
      machine.backupOriginalSegmentId ||
      (machine.segmentId === backupSegmentId ? "" : machine.segmentId);
    const originalSegmentName =
      machine.backupRealSegmentName ||
      machine.backupOriginalSegmentName ||
      (machine.segmentId === backupSegmentId ? "" : machine.segmentName);

    try {
      const response = await updateDeviceBackup(token, machine.id, {
        isBackup: nextIsBackup,
        status: "available",
        originalSegmentId,
        originalSegmentName
      });
      upsertDeviceInState(response.device);
      notify(nextIsBackup ? `${machine.name} marcada como Backup.` : `${machine.name} removida da area de Backup.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleBulkMarkBackup() {
    const machines = selectedAssets.filter((machine) => !machine.isBackup);
    if (!machines.length) {
      notify("As máquinas selecionadas já estão marcadas como Backup.", "ok");
      clearAssetSelection();
      return false;
    }

    try {
      await Promise.all(
        machines.map((machine) =>
          updateDeviceBackup(token, machine.id, {
            isBackup: true,
            status: "available",
            originalSegmentId:
              machine.backupRealSegmentId ||
              machine.backupOriginalSegmentId ||
              (machine.segmentId === backupSegmentId ? "" : machine.segmentId),
            originalSegmentName:
              machine.backupRealSegmentName ||
              machine.backupOriginalSegmentName ||
              (machine.segmentId === backupSegmentId ? "" : machine.segmentName)
          })
        )
      );
      notify(`${machines.length} máquinas marcadas como Backup.`, "ok");
      clearAssetSelection();
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  function upsertDeviceInState(device) {
    setAllDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return [...current, device];
    });
    setDevices((current) => {
      if (current.some((item) => item.id === device.id)) {
        return current.map((item) => (item.id === device.id ? device : item));
      }
      return current;
    });
    setSelectedDevice((current) => (current?.id === device.id ? device : current));
  }

  function appendDeviceHistoryEvent(machineId, event) {
    const update = (device) =>
      device.id === machineId
        ? { ...device, assetHistory: [event, ...(device.assetHistory || [])] }
        : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === machineId ? update(current) : current));
  }

  async function getOrCreateMaintenanceSegment(sourceGroupId = "", targetTabId = activeInventoryTab.id) {
    const existingActive = decoratedSegments.find(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === targetTabId &&
        isMaintenanceSegmentName(segment.name) &&
        getSegmentGroupId(segment, decoratedSegmentGroups) === sourceGroupId
    );
    if (existingActive) return existingActive;

    const response = await createSegment(token, {
      name: "Manutenção",
      color: "#f59e0b",
      groupId: sourceGroupId || null,
      systemSegment: "maintenance"
    });
    const nextSegment = { ...response.segment, groupId: response.segment.groupId || sourceGroupId };
    const targetSiblings = decoratedSegments.filter(
      (segment) =>
        !segment.isDefault &&
        segment.tabId === targetTabId &&
        getSegmentGroupId(segment, decoratedSegmentGroups) === sourceGroupId
    );

    setSegments((current) => upsertSegmentList(current, nextSegment));
    updateInventoryMeta("segments", response.segment.id, {
      tabId: targetTabId,
      order: targetSiblings.length
    });
    if (sourceGroupId) {
      saveSegmentGroups(assignSegmentToGroup(segmentGroups, response.segment.id, sourceGroupId));
    }

    return nextSegment;
  }

  async function ensureMachineInMaintenanceForServiceOrder(machine, serviceOrder) {
    if (!machine || !serviceOrder?.id) return false;

    const orderLabel = serviceOrder.number ? `#${serviceOrder.number}` : "";

    if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
      await addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada. Ela já estava em manutenção.",
        newValue: machine.name
      });
      return true;
    }

    try {
      const targetTabId =
        machine.tabId && machine.tabId !== "global-unorganized"
          ? machine.tabId
          : serviceOrder.environmentId || activeInventoryTab.id;
      const originSegment = decoratedSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, decoratedSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment(originGroupId, targetTabId);
      const previousSegment = machine.segmentName || "Não organizadas";
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: targetTabId,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

      const moved = await handleMoveMachine(machine, maintenanceSegment.id, {
        reason: "maintenance",
        targetTabId,
        forceSingle: true
      });
      if (!moved) return false;

      saveMaintenanceRecords((current) => ({
        ...current,
        [machine.id]: maintenanceRecord
      }));
      updateDeviceSegmentInState(machine.id, maintenanceSegment.id, maintenanceSegment.name, {
        maintenance: true,
        maintenanceOrigin: maintenanceRecord.origin
      });
      appendDeviceHistoryEvent(machine.id, {
        id: `${machine.id}-service-order-maintenance-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "maintenance",
        message: `Máquina colocada em manutenção automaticamente pela OS ${orderLabel}.`,
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });
      await addServiceOrderSystemHistory(serviceOrder.id, {
        eventType: "maintenance",
        message: "Máquina vinculada e colocada em manutenção.",
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function putMachineInMaintenance(machine) {
    if (!machine) return false;

    try {
      if (machine.maintenance || isMaintenanceSegmentName(machine.segmentName)) {
        return removeMachineFromMaintenance(machine);
      }

      const originSegment = activeSegments.find((segment) => segment.id === machine.segmentId);
      const originGroupId = originSegment ? getSegmentGroupId(originSegment, activeSegmentGroups) : "";
      const maintenanceSegment = await getOrCreateMaintenanceSegment(originGroupId);
      const previousSegment = machine.segmentName || "Não organizadas";
      const maintenanceRecord = {
        active: true,
        origin: {
          tabId: activeInventoryTab.id,
          groupId: originGroupId,
          segmentId: machine.segmentId,
          segmentName: previousSegment
        }
      };

      const moved = await handleMoveMachine(machine, maintenanceSegment.id, { reason: "maintenance" });
      if (!moved) return false;
      saveMaintenanceRecords((current) => ({
        ...current,
        [machine.id]: maintenanceRecord
      }));
      updateDeviceSegmentInState(machine.id, maintenanceSegment.id, maintenanceSegment.name, {
        maintenance: true,
        maintenanceOrigin: maintenanceRecord.origin
      });
      appendDeviceHistoryEvent(machine.id, {
        id: `${machine.id}-maintenance-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "maintenance",
        message: "Máquina colocada em manutenção",
        oldValue: previousSegment,
        newValue: maintenanceSegment.name
      });

      const hasOpenMaintenanceOrder = serviceOrders.some(
        (order) =>
          order.assetId === machine.id &&
          isMaintenanceServiceOrder(order) &&
          order.status !== "closed"
      );

      if (!hasOpenMaintenanceOrder) {
        const response = await createServiceOrder(token, {
          title: `Manutenção - ${machine.name}`,
          description: `Máquina ${machine.name} colocada em manutenção. Preencha o diagnóstico, atendimento e solução antes de finalizar.`,
          priority: "medium",
          category: "Manutenção",
          assetId: machine.id,
          environmentId: activeInventoryTab.id,
          environmentName: activeInventoryTab.name || "Novo ambiente",
          requesterName: user.name,
          assignedTechnicianName: "",
          notes: `Origem: ${previousSegment}`
        });

        setServiceOrders((current) => [response.serviceOrder, ...current]);
      }

      notify(`${machine.name} colocada em manutencao.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function removeMachineFromMaintenance(machine, options = {}) {
    if (!machine) return false;

    const serviceOrderLabel = options.serviceOrder?.number ? `#${options.serviceOrder.number}` : "";
    const record = maintenanceRecords[machine.id];
    const origin = record?.origin || machine.maintenanceOrigin;
    const fallbackSegment =
      activeSegments.find((segment) => segment.isDefault) ||
      decoratedSegments.find((segment) => segment.isDefault);
    const originSegment =
      origin?.segmentId &&
      !isMaintenanceSegmentName(origin.segmentName) &&
      (activeSegments.find((segment) => segment.id === origin.segmentId) ||
        decoratedSegments.find((segment) => segment.id === origin.segmentId) ||
        segments.find((segment) => segment.id === origin.segmentId));
    const targetSegment = originSegment || fallbackSegment;

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de retorno.", "danger");
      return false;
    }

    const machineForMove = { ...machine, maintenance: true };
    const moved = await handleMoveMachine(machineForMove, targetSegment.id, {
      reason: "maintenance_exit",
      targetTabId: origin?.tabId || machine.tabId || activeInventoryTab.id
    });
    if (!moved) return false;

    saveMaintenanceRecords((current) => {
      const next = { ...current };
      delete next[machine.id];
      return next;
    });
    updateDeviceSegmentInState(machine.id, targetSegment.id, targetSegment.name, {
      maintenance: false,
      maintenanceOrigin: null
    });
    appendDeviceHistoryEvent(machine.id, {
      id: `${machine.id}-maintenance-exit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      userName: user.name,
      eventType: "maintenance",
      message: options.serviceOrder
        ? originSegment
          ? `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}.`
          : `Máquina retirada da manutenção automaticamente pela finalização da OS ${serviceOrderLabel}, mas o segmento original não existe mais. Movida para Não organizadas.`
        : originSegment
          ? "Máquina retirada da manutenção"
          : "Máquina retirada da manutenção, mas o segmento original não existe mais. Movida para Não organizadas.",
      oldValue: machine.segmentName || "Manutenção",
      newValue: targetSegment.name
    });
    notify(`${machine.name} retirada da manutencao.`, "ok");
    return true;
  }

  function getDefaultInventorySegment() {
    return activeSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
      decoratedSegments.find((segment) => segment.isDefault && !segment.isBackupSegment) ||
      segments.find((segment) => segment.isDefault);
  }

  function getRealBackupLocation(machine) {
    const fallback = getDefaultInventorySegment();
    const segmentId =
      machine?.backupRealSegmentId ||
      machine?.backupOriginalSegmentId ||
      (machine?.segmentId && machine.segmentId !== backupSegmentId ? machine.segmentId : "");
    const segmentName =
      machine?.backupRealSegmentName ||
      machine?.backupOriginalSegmentName ||
      (machine?.segmentId && machine.segmentId !== backupSegmentId ? machine.segmentName : "");

    const segment =
      (segmentId &&
        (decoratedSegments.find((item) => item.id === segmentId) ||
          activeSegments.find((item) => item.id === segmentId) ||
          segments.find((item) => item.id === segmentId))) ||
      fallback;

    return {
      segmentId: segment?.id || segmentId || fallback?.id,
      segmentName: segment?.name || segmentName || fallback?.name || "Não organizadas",
      segment
    };
  }

  function getServiceOrderAssetOrigin(machine, order) {
    const record = maintenanceRecords[machine.id];
    const origin = record?.origin || machine.maintenanceOrigin;
    if (
      origin?.segmentId &&
      origin.segmentId !== backupSegmentId &&
      !isMaintenanceSegmentName(origin.segmentName)
    ) {
      return origin;
    }

    if (
      machine.segmentId &&
      machine.segmentId !== backupSegmentId &&
      !isMaintenanceSegmentName(machine.segmentName)
    ) {
      return {
        tabId:
          machine.tabId && machine.tabId !== "global-unorganized" && machine.tabId !== "global-backup"
            ? machine.tabId
            : order?.environmentId || activeInventoryTab.id,
        groupId: getSegmentGroupId(
          decoratedSegments.find((segment) => segment.id === machine.segmentId),
          decoratedSegmentGroups
        ),
        segmentId: machine.segmentId,
        segmentName: machine.segmentName
      };
    }

    const fallback = getDefaultInventorySegment();
    return fallback
      ? {
          tabId: order?.environmentId || activeInventoryTab.id,
          groupId: "",
          segmentId: fallback.id,
          segmentName: fallback.name
        }
      : null;
  }

  async function handleSelectBackupForServiceOrder(order, backupMachine) {
    if (!order || !backupMachine) return false;

    if (!order.assetId) {
      notify("Vincule a máquina principal antes de selecionar um Backup.", "danger");
      return false;
    }

    if (!backupMachine.isBackup) {
      notify("Selecione uma máquina marcada como Backup.", "danger");
      return false;
    }

    if (backupMachine.backupStatus === "in_use") {
      notify("Esta máquina Backup já está em uso em outra OS.", "danger");
      return false;
    }

    const mainMachine = findDecoratedDevice(order.assetId);
    if (!mainMachine) {
      notify("Não foi possível localizar a máquina principal da OS.", "danger");
      return false;
    }

    const targetOrigin = getServiceOrderAssetOrigin(mainMachine, order);
    if (!targetOrigin?.segmentId) {
      notify("Não foi possível localizar o segmento original da máquina principal.", "danger");
      return false;
    }

    const maintenanceReady = await ensureMachineInMaintenanceForServiceOrder(mainMachine, order);
    if (!maintenanceReady) return false;

    const backupOrigin = getRealBackupLocation(backupMachine);
    const targetSegment =
      decoratedSegments.find((segment) => segment.id === targetOrigin.segmentId) ||
      activeSegments.find((segment) => segment.id === targetOrigin.segmentId) ||
      segments.find((segment) => segment.id === targetOrigin.segmentId) ||
      getDefaultInventorySegment();

    if (!targetSegment) {
      notify("Não foi possível localizar o segmento de destino do Backup.", "danger");
      return false;
    }

    const moved = await handleMoveMachine(backupMachine, targetSegment.id, {
      reason: "backup_in_use",
      targetTabId: targetOrigin.tabId || order.environmentId || activeInventoryTab.id,
      forceSingle: true,
      allowBackupMove: true
    });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "in_use",
        serviceOrderId: order.id,
        originalSegmentId: backupOrigin.segmentId,
        originalSegmentName: backupOrigin.segmentName
      });
      upsertDeviceInState(backupResponse.device);

      const updatedOrder = await handleUpdateServiceOrder(order.id, { backupAssetId: backupMachine.id });
      await addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: "Backup selecionado e movido para o local da máquina principal.",
        oldValue: "",
        newValue: backupMachine.name
      });
      appendDeviceHistoryEvent(mainMachine.id, {
        id: `${mainMachine.id}-backup-replacement-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Substituída temporariamente por máquina Backup na OS #${order.number}.`,
        oldValue: mainMachine.name,
        newValue: backupMachine.name
      });
      appendDeviceHistoryEvent(backupMachine.id, {
        id: `${backupMachine.id}-backup-in-use-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Usada como substituta na OS #${order.number}.`,
        oldValue: backupOrigin.segmentName,
        newValue: targetSegment.name
      });
      await loadData(true);
      notify(`${backupMachine.name} alocada como Backup da OS ${updatedOrder?.number || order.number}.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function releaseBackupForServiceOrder(order, options = {}) {
    if (!order?.backupAssetId) return false;

    const backupMachine = findDecoratedDevice(order.backupAssetId);
    if (!backupMachine) {
      await handleUpdateServiceOrder(order.id, { backupAssetId: null });
      return true;
    }

    const backupOrigin = getRealBackupLocation(backupMachine);
    const targetSegment = backupOrigin.segment || getDefaultInventorySegment();

    if (!targetSegment?.id) {
      notify("Não foi possível localizar o retorno do Backup.", "danger");
      return false;
    }

    const moved = backupMachine.segmentId === targetSegment.id
      ? true
      : await handleMoveMachine(backupMachine, targetSegment.id, {
          reason: "backup_return",
          targetTabId: backupMachine.tabId || activeInventoryTab.id,
          forceSingle: true,
          allowBackupMove: true
        });
    if (!moved) return false;

    try {
      const backupResponse = await updateDeviceBackup(token, backupMachine.id, {
        isBackup: true,
        status: "available",
        serviceOrderId: null,
        originalSegmentId: targetSegment.id,
        originalSegmentName: targetSegment.name
      });
      upsertDeviceInState(backupResponse.device);
      await handleUpdateServiceOrder(order.id, { backupAssetId: null });
      await addServiceOrderSystemHistory(order.id, {
        eventType: "backup",
        message: options.finalized
          ? "OS finalizada e máquina Backup devolvida para a área Backup."
          : "Máquina Backup devolvida para a área Backup.",
        oldValue: backupMachine.name,
        newValue: backupSegmentName
      });
      appendDeviceHistoryEvent(backupMachine.id, {
        id: `${backupMachine.id}-backup-return-${Date.now()}`,
        createdAt: new Date().toISOString(),
        userName: user.name,
        eventType: "backup",
        message: `Devolvida para a area Backup pela OS #${order.number}.`,
        oldValue: backupMachine.segmentName,
        newValue: backupSegmentName
      });
      await loadData(true);
      notify(`${backupMachine.name} devolvida para Backup.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function removeMachineFromInventory(machine) {
    if (!machine) return false;

    const confirmed = window.confirm(
      `Remover "${machine.name}" do inventário?\n\nA máquina/ativo deixará de aparecer no inventário. Esta ação deve ser usada apenas quando o equipamento saiu do ambiente monitorado.`
    );
    if (!confirmed) return false;

    try {
      await deleteDevice(token, machine.id);
      setAllDevices((current) => current.filter((device) => device.id !== machine.id));
      setDevices((current) => current.filter((device) => device.id !== machine.id));
      setSelectedDevice((current) => (current?.id === machine.id ? null : current));
      setSelectedAssetIds((current) => {
        const next = new Set(current);
        next.delete(machine.id);
        return next;
      });
      notify(`${machine.name} removida do inventario.`, "ok");
      await loadData(true);
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    }
  }

  async function handleCreateManualAsset(payload) {
    setManualAssetSaving(true);
    try {
      const response = await createManualAsset(token, payload);
      upsertDeviceInState(response.device);
      updateInventoryMeta("devices", response.device.id, {
        tabId: activeInventoryTab.id,
        order: activeAllDevices.length
      });
      setManualAssetFormOpen(false);
      notify(`Ativo ${response.device.name} criado.`, "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setManualAssetSaving(false);
    }
  }

  async function handleRefreshPing(machine) {
    if (!machine || machine.source !== "manual") return;

    try {
      const response = await refreshAssetPing(token, machine.id);
      upsertDeviceInState(response.device);
      notify(response.ping.message, response.device.status === "online" ? "ok" : "danger");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function handleChangeDeviceType(deviceId, assetType) {
    try {
      const response = await updateDeviceType(token, deviceId, assetType);
      upsertDeviceInState(response.device);
      notify("Tipo do aparelho atualizado.", "ok");
      await loadData(true);
      return response.device;
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function handleInventoryDragStart(event) {
    if (activeView !== "inventory") return;

    const machineId = event.active?.data?.current?.machineId;
    const segmentId = event.active?.data?.current?.segmentId;
    const activeType = event.active?.data?.current?.type;
    window.dispatchEvent(new CustomEvent("it-guardian:close-popovers"));
    document.body.classList.add("is-inventory-dragging");
    dragStartScrollY.current = window.scrollY;
    sidebarWasCollapsedBeforeDrag.current = sidebarCollapsed;
    window.clearTimeout(sidebarAutoCloseTimer.current);
    setSidebarDragActive(true);
    setSidebarCollapsed(false);
    setActiveDragMachine(activeType === "machine" ? activeAllDevices.find((device) => device.id === machineId) || null : null);
    setActiveDragSegment(activeType === "segment" ? activeSegments.find((segment) => segment.id === segmentId) || null : null);
    if (machineId && !selectedAssetIds.has(machineId)) {
      setSelectedAssetIds(new Set([machineId]));
    }
  }

  function handleInventoryDragCancel({ forceCollapse = false } = {}) {
    document.body.classList.remove("is-inventory-dragging");
    setActiveDragMachine(null);
    setActiveDragSegment(null);
    setSidebarDragActive(false);
    window.clearTimeout(sidebarAutoCloseTimer.current);

    if (forceCollapse) {
      setSidebarHoverOpen(false);
      setSidebarCollapsed(true);
      return;
    }

    if (sidebarWasCollapsedBeforeDrag.current) {
      sidebarAutoCloseTimer.current = window.setTimeout(() => setSidebarCollapsed(true), 950);
    }
  }

  function animateScrollForDrop(result) {
    if (!result?.moved) return;

    const target = document.getElementById(`inventory-segment-${result.targetSegmentId}`);

    if (target) {
      window.setTimeout(() => {
        target.classList.add("drop-confirm-highlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 110);

      window.setTimeout(() => {
        target.classList.remove("drop-confirm-highlight");
      }, 1150);
    }

    window.setTimeout(() => {
      window.scrollTo({ top: dragStartScrollY.current, behavior: "smooth" });
    }, target ? 920 : 260);
  }

  function handleInventoryBoardDragEnd(event) {
    let result = null;
    let droppedViaSidebar = false;
    if (activeView === "inventory") {
      const activeType = event.active?.data?.current?.type;
      const overType = event.over?.data?.current?.type;
      droppedViaSidebar = overType === "sidebar-segment" || overType === "sidebar-segment-group-drop";

      if (activeType === "segment") {
        const segmentId = event.active?.data?.current?.segmentId;
        const groupId = event.over?.data?.current?.groupId;

        if (
          segmentId &&
          (overType === "segment-group-drop" || overType === "sidebar-segment-group-drop") &&
          groupId !== undefined
        ) {
          const segment = activeSegments.find((item) => item.id === segmentId) || segments.find((item) => item.id === segmentId);
          const currentGroupId = getSegmentGroupId(segment, activeSegmentGroups);

          if (segment && !segment.isDefault && currentGroupId !== groupId) {
            moveSegmentToGroup(segmentId, groupId);
            result = { moved: true, targetSegmentId: segmentId };
            notify(
              groupId
                ? `${segment.name} movido para ${activeSegmentGroups.find((group) => group.id === groupId)?.name || "grupo"}.`
                : `${segment.name} movido para Sem grupo.`,
              "ok"
            );
          }
        }
      } else {
        result = handleInventoryDragEnd(event);
      }
    }
    handleInventoryDragCancel({ forceCollapse: droppedViaSidebar });
    animateScrollForDrop(result);
  }

  function openMoveModal(machine, targetSegmentId = machine.segmentId) {
    setMoveModal(machine);
    setMoveTarget(targetSegmentId);
  }

  function saveMachineAlias(machineId, alias) {
    setMachineAliases((current) => {
      const next = { ...current };
      if (alias) {
        next[machineId] = alias;
      } else {
        delete next[machineId];
      }
      localStorage.setItem(aliasKey, JSON.stringify(next));
      return next;
    });
    notify(alias ? "Nome fantasia atualizado." : "Nome fantasia removido.", "ok");
  }

  function addMachineObservation(machineId, text) {
    setMachineObservations((current) => {
      const next = {
        ...current,
        [machineId]: [
          {
            id: `${machineId}-${Date.now()}`,
            createdAt: new Date().toISOString(),
            user: user.name,
            text
          },
          ...(current[machineId] || [])
        ]
      };
      localStorage.setItem(observationsKey, JSON.stringify(next));
      return next;
    });
    notify("Observacao adicionada.", "ok");
  }

  function removeMachinePeripheral(machineId, peripheral) {
    const confirmed = window.confirm(`Remover periferico "${peripheral.type}" deste ativo?`);
    if (!confirmed) return null;

    const removedKey = peripheralKey(peripheral);
    const event = {
      id: `${machineId}-peripheral-removed-${Date.now()}`,
      createdAt: new Date().toISOString(),
      user: user.name,
      change: `Periferico removido: ${peripheral.type}`,
      message: `${peripheral.type} - ${peripheral.brand || "Sem marca"} - ${peripheral.assetTag || "Sem patrimonio"}`,
      field: "peripherals",
      oldValue: `${peripheral.type} ${peripheral.brand || ""} ${peripheral.assetTag || ""}`.trim(),
      newValue: "Removido"
    };

    setRemovedPeripherals((current) => {
      const next = {
        ...current,
        [machineId]: Array.from(new Set([...(current[machineId] || []), removedKey]))
      };
      localStorage.setItem(peripheralRemovalsKey, JSON.stringify(next));
      return next;
    });

    setPeripheralHistory((current) => {
      const next = {
        ...current,
        [machineId]: [event, ...(current[machineId] || [])]
      };
      localStorage.setItem(peripheralHistoryKey, JSON.stringify(next));
      return next;
    });

    const update = (device) =>
      device.id === machineId
        ? {
            ...device,
            assetHistory: [event, ...(device.assetHistory || [])],
            hardware: {
              ...device.hardware,
              peripherals: (device.hardware?.peripherals || []).filter((item) => peripheralKey(item) !== removedKey)
            }
          }
        : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === machineId ? update(current) : current));
    notify("Periferico removido e registrado no historico.", "ok");
    return event;
  }

  function saveSegmentGroups(nextGroups) {
    setSegmentGroups(nextGroups);
  }

  function openSegmentGroupForm() {
    setSegmentGroupForm({ mode: "create", group: null });
  }

  function renameSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;
    setSegmentGroupForm({ mode: "edit", group });
  }

  async function submitSegmentGroupForm(name, color) {
    const cleanName = name.trim();
    const nextColor = color || pickUnusedPaletteColor(activeSegmentGroups);
    const duplicate = activeSegmentGroups.some(
      (group) =>
        group.id !== segmentGroupForm?.group?.id &&
        group.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      notify("Ja existe um grupo com esse nome.", "danger");
      return;
    }

    setSegmentGroupSaving(true);
    try {
      if (segmentGroupForm?.mode === "create") {
        const response = await createSegmentGroupApi(token, {
          name: cleanName,
          color: nextColor
        });
        saveSegmentGroups([...segmentGroups, response.group]);
        updateInventoryMeta("groups", response.group.id, {
          tabId: activeInventoryTab.id,
          order: activeSegmentGroups.length
        });
        notify("Grupo criado.", "ok");
      } else if (segmentGroupForm?.group?.id) {
        const response = await updateSegmentGroup(token, segmentGroupForm.group.id, {
          name: cleanName,
          color: nextColor
        });
        saveSegmentGroups(
          segmentGroups.map((item) =>
            item.id === segmentGroupForm.group.id ? { ...item, ...response.group } : item
          )
        );
        notify("Grupo renomeado.", "ok");
      }

      setSegmentGroupForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentGroupSaving(false);
    }
  }

  function toggleSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const collapsed = !group.collapsed;
    saveSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, collapsed } : item)));
    updateSegmentGroup(token, groupId, { collapsed }).catch((error) => notify(error.message, "danger"));
  }

  async function changeSegmentGroupColor(groupId, color) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group || !color || group.color === color) return;

    saveSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, color } : item)));

    try {
      const response = await updateSegmentGroup(token, groupId, { color });
      saveSegmentGroups(
        segmentGroups.map((item) =>
          item.id === groupId ? { ...item, ...response.group } : item
        )
      );
    } catch (error) {
      saveSegmentGroups(segmentGroups);
      notify(error.message, "danger");
    }
  }

  async function deleteSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const segmentCount = activeSegments.filter((segment) => getSegmentGroupId(segment, activeSegmentGroups) === groupId).length;
    const confirmed = segmentCount
      ? window.confirm(`Excluir o grupo "${group.name}" e mover ${segmentCount} segmento(s) para Sem grupo?`)
      : window.confirm(`Excluir o grupo "${group.name}"?`);

    if (!confirmed) return;

    try {
      await deleteSegmentGroupApi(token, groupId);
      saveSegmentGroups(segmentGroups.filter((item) => item.id !== groupId));
      setSegments((current) =>
        current.map((segment) => (segment.groupId === groupId ? { ...segment, groupId: "" } : segment))
      );

      if (selectedInventoryGroup === groupId) {
        setSelectedInventoryGroup("all");
        setSelectedInventorySegment("all");
      }

      notify("Grupo excluido. Segmentos mantidos em Sem grupo.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function moveSegmentToGroup(segmentId, groupId) {
    const previousGroups = segmentGroups;
    const nextGroups = assignSegmentToGroup(segmentGroups, segmentId, groupId);
    saveSegmentGroups(nextGroups.map((group) => (group.id === groupId ? { ...group, collapsed: false } : group)));
    const targetGroupId = groupId || "";
    const targetSiblings = activeSegments.filter(
      (segment) => segment.id !== segmentId && getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId
    );
    updateInventoryMeta("segments", segmentId, {
      tabId: activeInventoryTab.id,
      order: targetSiblings.length
    });
    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, groupId: groupId || "" } : segment))
    );
    renameSegment(token, segmentId, { groupId: groupId || null }).catch(async (error) => {
      saveSegmentGroups(previousGroups);
      await loadData(true);
      notify(error.message, "danger");
    });
  }

  function handleCreateSegment() {
    const groupId =
      selectedInventoryGroup === "all" || selectedInventoryGroup === "ungrouped"
        ? ""
        : selectedInventoryGroup;
    setSegmentForm({ mode: "create", segment: null, groupId });
  }

  async function submitSegmentForm(name, groupId = "") {
    const cleanName = name.trim();
    const targetGroupId = groupId || "";

    if (isReservedSegmentName(cleanName)) {
      notify("Esse nome e reservado pelo sistema.", "danger");
      return;
    }

    const duplicate = hasDuplicateSegmentName(activeSegments, {
      name: cleanName,
      groupId: targetGroupId,
      excludeId: segmentForm?.segment?.id,
      groups: activeSegmentGroups
    });

    if (duplicate) {
      notify("Ja existe um segmento com esse nome neste grupo.", "danger");
      return;
    }

    setSegmentSaving(true);
    try {
      if (segmentForm?.mode === "rename") {
        const response = await renameSegment(token, segmentForm.segment.id, {
          name: cleanName,
          groupId: targetGroupId || null
        });
        const nextGroups = assignSegmentToGroup(segmentGroups, segmentForm.segment.id, targetGroupId);
        saveSegmentGroups(nextGroups);
        updateInventoryMeta("segments", segmentForm.segment.id, { tabId: activeInventoryTab.id });
        setSegments((current) =>
          current.map((item) =>
            item.id === segmentForm.segment.id
              ? { ...item, name: response.segment.name, groupId: response.segment.groupId || "" }
              : item
          )
        );
        setAllDevices((current) =>
          current.map((device) =>
            device.segmentId === segmentForm.segment.id ? { ...device, segmentName: response.segment.name } : device
          )
        );
        notify("Segmento renomeado.", "ok");
      } else {
        const response = await createSegment(token, {
          name: cleanName,
          color: pickSegmentColor(activeSegments),
          groupId: targetGroupId || null
        });
        const nextSegment = { ...response.segment, groupId: response.segment.groupId || targetGroupId };
        const targetSiblings = activeSegments.filter(
          (segment) => getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId
        );
        setSegments((current) => upsertSegmentList(current, nextSegment));
        updateInventoryMeta("segments", response.segment.id, {
          tabId: activeInventoryTab.id,
          order: targetSiblings.length
        });
        if (targetGroupId) {
          saveSegmentGroups(assignSegmentToGroup(segmentGroups, response.segment.id, targetGroupId));
        }
        notify(`Segmento ${response.segment.name} criado.`, "ok");
      }
      setSegmentForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentSaving(false);
    }
  }

  function handleRenameSegment(segment) {
    setSegmentForm({ mode: "rename", segment, groupId: segment.groupId || "" });
  }

  async function handleChangeSegmentColor(segment, color) {
    if (!color || color === segment.color) return;

    setSegments((current) =>
      current.map((item) => (item.id === segment.id ? { ...item, color } : item))
    );

    try {
      const response = await renameSegment(token, segment.id, { color });
      setSegments((current) =>
        current.map((item) => (item.id === segment.id ? { ...item, color: response.segment.color } : item))
      );
      await loadData(true);
    } catch (error) {
      setSegments((current) =>
        current.map((item) => (item.id === segment.id ? { ...item, color: segment.color } : item))
      );
      notify(error.message, "danger");
    }
  }

  async function handleDeleteSegment(segment) {
    const confirmed = window.confirm(
      `Excluir o segmento "${segment.name}"? As máquinas vão voltar para Não organizadas.`
    );
    if (!confirmed) return;

    try {
      const wasMaintenanceSegment = isMaintenanceSegmentName(segment.name);
      const affectedMaintenanceMachines = wasMaintenanceSegment
        ? activeAllDevices.filter((device) => device.segmentId === segment.id)
        : [];
      await deleteSegment(token, segment.id);
      saveSegmentGroups(assignSegmentToGroup(segmentGroups, segment.id, ""));
      setSegments((current) => current.filter((item) => item.id !== segment.id));
      if (wasMaintenanceSegment && affectedMaintenanceMachines.length) {
        saveMaintenanceRecords((current) => {
          const next = { ...current };
          for (const machine of affectedMaintenanceMachines) {
            delete next[machine.id];
          }
          return next;
        });
        const defaultSegment = activeSegments.find((item) => item.isDefault);
        const eventTime = new Date().toISOString();
        for (const machine of affectedMaintenanceMachines) {
          updateDeviceSegmentInState(machine.id, defaultSegment?.id, defaultSegment?.name || "Não organizadas", {
            maintenance: false,
            maintenanceOrigin: null
          });
          appendDeviceHistoryEvent(machine.id, {
            id: `${machine.id}-maintenance-segment-removed-${Date.now()}`,
            createdAt: eventTime,
            userName: user.name,
            eventType: "maintenance",
            message: "Segmento Manutenção removido. Máquina movida para Não organizadas.",
            oldValue: segment.name,
            newValue: defaultSegment?.name || "Não organizadas"
          });
        }
      }
      notify("Segmento excluído. Máquinas movidas para Não organizadas.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function selectInventoryTab(tabId) {
    if (!inventoryTabs.some((tab) => tab.id === tabId)) return;
    setActiveInventoryTabId(tabId);
  }

  function createInventoryTab() {
    const cleanName = getNextInventoryTabName(inventoryTabs);

    const nextTab = {
      id: `tab-${Date.now()}`,
      name: cleanName,
      color: pickUnusedPaletteColor(inventoryTabs),
      order: inventoryTabs.length
    };

    saveInventoryTabs((current) => [...current, nextTab]);
    setActiveInventoryTabId(nextTab.id);
    notify(`Ambiente ${nextTab.name} criado.`, "ok");
  }

  function renameInventoryTab(tabId) {
    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    setInventoryTabForm(tab);
  }

  function submitInventoryTabForm(name) {
    const cleanName = name.trim();
    const tabId = inventoryTabForm?.id;
    if (!cleanName || !tabId) return;
    const duplicate = inventoryTabs.some(
      (item) => item.id !== tabId && item.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      notify("Ja existe uma aba com esse nome.", "danger");
      return;
    }

    saveInventoryTabs((current) =>
      current.map((item) => (item.id === tabId ? { ...item, name: cleanName } : item))
    );
    setInventoryTabForm(null);
    notify("Ambiente renomeado.", "ok");
  }

  function deleteInventoryTab(tabId) {
    if (inventoryTabs.length <= 1) {
      notify("Mantenha pelo menos uma aba no inventario.", "danger");
      return;
    }

    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    const remainingTabs = inventoryTabs.filter((item) => item.id !== tabId);
    const fallbackTab = remainingTabs[0] || defaultInventoryTab;
    const confirmed = window.confirm(
      `Excluir a aba "${tab.name}"? Os dados locais dela serao movidos para "${fallbackTab.name}".`
    );
    if (!confirmed) return;

    saveInventoryTabs(remainingTabs.map((item, index) => ({ ...item, order: index })));
    saveInventoryTabMeta((current) => {
      const reassign = (collection) =>
        Object.fromEntries(
          Object.entries(collection || {}).map(([id, meta]) => [
            id,
            meta.tabId === tabId ? { ...meta, tabId: fallbackTab.id } : meta
          ])
        );

      return {
        groups: reassign(current.groups),
        segments: reassign(current.segments),
        devices: reassign(current.devices)
      };
    });
    setActiveInventoryTabId(fallbackTab.id);
    notify("Aba excluida. Dados movidos para outro ambiente.", "ok");
  }

  function changeInventoryTabColor(tabId, color) {
    saveInventoryTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, color } : tab))
    );
  }

  function moveGroupOrder(groupId, direction) {
    const orderedIds = activeSegmentGroups.map((group) => group.id);
    const nextIds = moveIdInList(orderedIds, groupId, direction);
    if (nextIds === orderedIds) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      groups: {
        ...(current.groups || {}),
        ...Object.fromEntries(
          nextIds.map((id, index) => [
            id,
            {
              ...(current.groups?.[id] || {}),
              tabId: activeInventoryTab.id,
              order: index
            }
          ])
        )
      }
    }));
  }

  function moveSegmentOrder(segment, direction) {
    const groupId = getSegmentGroupId(segment, activeSegmentGroups);
    const orderedIds = activeSegments
      .filter((item) => !item.isDefault && getSegmentGroupId(item, activeSegmentGroups) === groupId)
      .map((item) => item.id);
    const nextIds = moveIdInList(orderedIds, segment.id, direction);
    if (nextIds === orderedIds) return;

    saveInventoryTabMeta((current) => ({
      ...current,
      segments: {
        ...(current.segments || {}),
        ...Object.fromEntries(
          nextIds.map((id, index) => [
            id,
            {
              ...(current.segments?.[id] || {}),
              tabId: activeInventoryTab.id,
              order: index
            }
          ])
        )
      }
    }));
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    onLogout();
  }

  const activeDragSegmentGroupId = activeDragSegment
    ? getSegmentGroupId(activeDragSegment, activeSegmentGroups)
    : "";
  const activeDragSegmentGroupName = activeDragSegmentGroupId
    ? activeSegmentGroups.find((group) => group.id === activeDragSegmentGroupId)?.name || ""
    : "Sem grupo";
  const activeDragSegmentCount = activeDragSegment
    ? activeAllDevices.filter((device) => device.segmentId === activeDragSegment.id).length
    : 0;
  const sidebarExpanded = !sidebarCollapsed || sidebarHoverOpen || sidebarDragActive;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={inventoryCollisionDetection}
      onDragStart={handleInventoryDragStart}
      onDragEnd={handleInventoryBoardDragEnd}
      onDragCancel={handleInventoryDragCancel}
    >
    <main className={`app-shell ${sidebarExpanded ? "" : "sidebar-collapsed"} ${sidebarDragActive ? "sidebar-drag-active" : ""}`}>
      <aside
        className="sidebar"
        onMouseEnter={() => {
          if (!sidebarDragActive) setSidebarHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (sidebarDragActive) return;
          setSidebarHoverOpen(false);
          setSidebarCollapsed(true);
        }}
      >
        <button
          type="button"
          className="brand-mark compact sidebar-brand-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarExpanded ? "Recolher sidebar" : "Expandir sidebar"}
        >
          <ShieldCheck size={28} />
          <strong>IT Guardian</strong>
          <PanelLeftClose size={16} className="sidebar-collapse-indicator" />
        </button>
        <nav>
          {canViewDashboard && (
            <button className={activeView === "dashboard" ? "nav-active" : ""} onClick={() => setActiveView("dashboard")}>
              <Activity size={18} /> <span className="nav-label">Dashboard</span>
            </button>
          )}
          {(canViewAlerts || canViewScripts) && (
            <button className={activeView === "alerts" ? "nav-active" : ""} onClick={() => setActiveView("alerts")}>
              <AlertTriangle size={18} /> <span className="nav-label">Avisos</span>
            </button>
          )}
          {canViewServiceOrders && (
            <button className={activeView === "service-orders" ? "nav-active" : ""} onClick={() => setActiveView("service-orders")}>
              <ClipboardList size={18} /> <span className="nav-label">Ordens de Serviço</span>
            </button>
          )}
          {canViewInventory && (
            <button className={activeView === "inventory" ? "nav-active" : ""} onClick={() => setActiveView("inventory")}>
              <Database size={18} /> <span className="nav-label">Inventário</span>
            </button>
          )}
          {activeView === "inventory" && sidebarExpanded && (
            <SidebarSegmentFilter
              devices={activeAllDevices}
              segments={activeSegments}
              groups={activeSegmentGroups}
              selectedGroupId={selectedInventoryGroup}
              selectedSegmentId={selectedInventorySegment}
              machineDragActive={Boolean(activeDragMachine)}
              onSelectGroup={selectInventoryGroup}
              onSelectSegment={selectInventorySegment}
              onToggleGroup={toggleSegmentGroup}
            />
          )}
        </nav>
        {canOpenGeneralSettings && (
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-general-settings-button"
              onClick={() => setGeneralSettingsOpen(true)}
              title="Configurações gerais"
            >
              <SettingsIcon size={18} />
              <span className="nav-label">Configurações</span>
            </button>
          </div>
        )}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Infraestrutura em tempo real</h1>
            <p>Ultima atualizacao: {formatTime(lastUpdated)}</p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => loadData()} title="Atualizar">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button" onClick={onToggleTheme} title={theme === "dark" ? "Modo claro" : "Modo noturno"}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" onClick={logout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeView === "blocked" && <PermissionBlocked />}

        {activeView === "dashboard" && canViewDashboard && (
          <>
            {summary && (
              <section className="summary-grid">
                <SummaryCard icon={Server} label="Dispositivos" value={summary.totalDevices} />
                <SummaryCard icon={ShieldCheck} label="Online" value={summary.online} tone="ok" />
                <SummaryCard icon={WifiOff} label="Erro" value={summary.offline} tone="danger" />
                <SummaryCard icon={AlertTriangle} label="Críticos" value={summary.criticalAlerts} tone="danger" />
              </section>
            )}

            <section className="toolbar">
              <div className="search-box">
                <Search size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, IP ou status" />
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos os status</option>
                <option value="online">Online</option>
                <option value="problem">Problema</option>
                <option value="offline">Erro</option>
              </select>
            </section>

            <section className="content-grid">
              <section className="panel devices-panel">
                <div className="panel-heading">
                  <h2>Máquinas monitoradas</h2>
                  {loading && <span className="loading">Carregando...</span>}
                </div>
                <DeviceTable devices={devices} selectedId={selectedId} onSelect={selectDevice} />
              </section>
              <AlertList alerts={alerts} />
            </section>

            <section className="bottom-grid">
              <DeviceDetails device={selectedDevice} />
              <section className="panel history-panel">
                <div className="panel-heading">
                  <h2>Histórico de avisos</h2>
                  <Network size={18} />
                </div>
                <div className="chart-box compact-chart">
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={alertTrend}>
                      <XAxis dataKey="label" stroke="#69758a" />
                      <YAxis allowDecimals={false} stroke="#69758a" />
                      <Tooltip />
                      <Area dataKey="critical" stackId="1" stroke="#d64545" fill="#d64545" />
                      <Area dataKey="warning" stackId="1" stroke="#d6a21f" fill="#d6a21f" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="history-list">
                  {history.map((alert) => (
                    <div key={alert.id}>
                      <span className={`dot ${alert.severity}`} />
                      <strong>{alert.hostName}</strong>
                      <span>{alert.title}{alert.acknowledgement ? " - resolvido" : ""}</span>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}

        {activeView === "alerts" && (canViewAlerts || canViewScripts || canViewPreventivePlans || canViewPreventiveAutomation) && (
          <AlertCenterV2
            alerts={alerts}
            history={history}
            suggestions={serviceOrderSuggestions}
            rules={alertRules}
            scripts={maintenanceScripts}
            preventivePlans={preventivePlans}
            preventiveAutomationPlans={preventiveAutomationPlans}
            devices={allDevices}
            segments={decoratedSegments}
            segmentGroups={decoratedSegmentGroups}
            inventoryTabs={inventoryTabs}
            alertPriorityColors={alertPriorityColors}
            alertPrioritySettings={alertPrioritySettings}
            alertCorrelations={alertCorrelations}
            serviceOrders={serviceOrders}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            statusFilter={alertStatusFilter}
            setStatusFilter={setAlertStatusFilter}
            suggestionStatusFilter={suggestionStatusFilter}
            setSuggestionStatusFilter={setSuggestionStatusFilter}
            canViewAlerts={canViewAlerts}
            canManageSuggestions={canManageAlertSuggestions}
            canConfigureAlerts={canConfigureAlerts}
            canConfigureAlertPrioritySettings={canConfigureAlertPrioritySettings}
            canCommentAlerts={canCommentAlerts}
            canViewScripts={canViewScripts}
            canManageScripts={canManageScripts}
            canRegisterScriptSimulation={canRegisterScriptSimulation}
            canUseScriptsFromAlerts={canUseScriptsFromAlerts}
            canViewScriptLogs={canViewScriptLogs}
            canResolveScriptLogs={canResolveScriptLogs}
            canManageScriptValidations={canManageScriptValidations}
            canViewPreventivePlans={canViewPreventivePlans}
            canCreatePreventivePlans={canCreatePreventivePlans}
            canCreatePreventiveServiceOrder={canCreatePreventiveServiceOrder}
            canViewPreventiveAutomation={canViewPreventiveAutomation}
            canCreatePreventiveAutomation={canCreatePreventiveAutomation}
            canUpdatePreventiveAutomation={canUpdatePreventiveAutomation}
            canDisablePreventiveAutomation={canDisablePreventiveAutomation}
            canPreparePreventiveAutomation={canPreparePreventiveAutomation}
            onEvaluateAlerts={handleEvaluateAlerts}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onCreatePreventivePlan={handleCreatePreventivePlan}
            onCreatePreventivePlanServiceOrder={handleCreatePreventivePlanServiceOrder}
            onSavePreventiveAutomationPlan={handleSavePreventiveAutomationPlan}
            onDisablePreventiveAutomationPlan={handleDisablePreventiveAutomationPlan}
            onPreparePreventiveAutomationPlan={handlePreparePreventiveAutomationPlan}
            onOpenServiceOrders={() => setActiveView("service-orders")}
            onUpdateRule={handleUpdateAlertRule}
            onAddAlertComment={handleAddAlertComment}
            onSaveAlertPrioritySettings={handleSaveAlertPrioritySettings}
            onAnalyzeMaintenanceScript={handleAnalyzeMaintenanceScript}
            onSaveMaintenanceScript={handleSaveMaintenanceScript}
            onDeactivateMaintenanceScript={handleDeactivateMaintenanceScript}
            onRegisterMaintenanceScriptSimulation={handleRegisterMaintenanceScriptSimulation}
            onUseSuggestionScript={handleUseSuggestionScript}
            onAcknowledgeScriptLog={handleAcknowledgeScriptLog}
            onApplyScriptLogSuggestedSolution={handleApplyScriptLogSuggestedSolution}
            onCancelScriptValidation={handleCancelScriptValidation}
          />
        )}

        {activeView === "inventory" && canViewInventory && (
          <InventoryBoard
            devices={activeAllDevices}
            segments={activeSegments}
            machinesBySegment={machinesBySegment}
            search={inventorySearch}
            setSearch={setInventorySearch}
            selectedGroupId={selectedInventoryGroup}
            selectedSegmentId={selectedInventorySegment}
            selectedAssetIds={selectedAssetIds}
            isBulkSelectionDragging={Boolean(
              sidebarDragActive &&
              activeDragMachine &&
              selectedAssetIds.has(activeDragMachine.id) &&
              selectedAssetIds.size > 1
            )}
            bulkMoveTarget={bulkMoveTarget}
            aliases={machineAliases}
            observations={machineObservations}
            userName={user.name}
            canManage={canManageInventory}
            moveModal={moveModal}
            moveTarget={moveTarget}
            setMoveTarget={setMoveTarget}
            onCreateSegment={handleCreateSegment}
            onRenameSegment={handleRenameSegment}
            onDeleteSegment={handleDeleteSegment}
            onChangeSegmentColor={handleChangeSegmentColor}
            onAliasSave={saveMachineAlias}
            onAddObservation={addMachineObservation}
            onMoveMachine={handleMoveMachine}
            onBulkMoveTargetChange={setBulkMoveTarget}
            onBulkMove={handleBulkMove}
            onBulkPrint={handleBulkPrint}
            onBulkMarkBackup={handleBulkMarkBackup}
            onClearSelection={clearAssetSelection}
            onSelectAsset={handleSelectAsset}
            onToggleSelection={toggleAssetSelection}
            groups={activeSegmentGroups}
            onSelectGroup={selectInventoryGroup}
            onCreateGroup={openSegmentGroupForm}
            onRenameGroup={renameSegmentGroup}
            onDeleteGroup={deleteSegmentGroup}
            onChangeGroupColor={changeSegmentGroupColor}
            onToggleGroup={toggleSegmentGroup}
            onMoveGroupOrder={moveGroupOrder}
            onMoveSegmentToGroup={moveSegmentToGroup}
            onMoveSegmentOrder={moveSegmentOrder}
            tabs={inventoryTabs}
            activeTab={activeInventoryTab}
            activeTabId={activeInventoryTab.id}
            onSelectTab={selectInventoryTab}
            onCreateTab={createInventoryTab}
            onRenameTab={renameInventoryTab}
            onDeleteTab={deleteInventoryTab}
            onChangeTabColor={changeInventoryTabColor}
            onRemovePeripheral={removeMachinePeripheral}
            onCreateManualAsset={() => setManualAssetFormOpen(true)}
            onRefreshPing={handleRefreshPing}
            onChangeDeviceType={handleChangeDeviceType}
            onPutMaintenance={putMachineInMaintenance}
            onToggleBackup={handleToggleBackup}
            onRemoveMachine={removeMachineFromInventory}
            onCloseMoveModal={() => setMoveModal(null)}
            onOpenMoveModal={openMoveModal}
          />
        )}

        {activeView === "service-orders" && canViewServiceOrders && (
          <ServiceOrdersBoard
            serviceOrders={serviceOrders}
            devices={decoratedAllDevices}
            segments={decoratedSegments}
            groups={decoratedSegmentGroups}
            tabs={inventoryTabs}
            activeTab={activeInventoryTab}
            token={token}
            notify={notify}
            systemMode={systemMode}
            saving={serviceOrderSaving}
            onCreate={handleCreateServiceOrder}
            onUpdate={handleUpdateServiceOrder}
            onAddHistory={handleAddServiceOrderHistory}
            onStatusChange={handleChangeServiceOrderStatus}
            onDelete={handleDeleteServiceOrder}
            onSelectBackup={handleSelectBackupForServiceOrder}
            onReleaseBackup={releaseBackupForServiceOrder}
            user={user}
            permissions={{
              create: hasPermission(user, "service_orders.create"),
              edit: hasPermission(user, "service_orders.edit"),
              viewAll: hasPermission(user, "service_orders.view_all"),
              changeSector: hasPermission(user, "service_orders.change_sector"),
              changeStatus: hasPermission(user, "service_orders.change_status"),
              finish: hasPermission(user, "service_orders.finish"),
              attendance: hasPermission(user, "service_orders.attendance"),
              parts: hasPermission(user, "service_orders.parts"),
              print: hasPermission(user, "service_orders.print"),
              settings: hasPermission(user, "service_orders.settings")
            }}
          />
        )}

      </section>
      <SegmentFormModal
        mode={segmentForm?.mode}
        segment={segmentForm?.segment}
        segments={activeSegments}
        groups={activeSegmentGroups}
        selectedGroupId={segmentForm?.groupId || ""}
        saving={segmentSaving}
        onClose={() => setSegmentForm(null)}
        onSubmit={submitSegmentForm}
      />
      <SegmentGroupFormModal
        mode={segmentGroupForm?.mode}
        group={segmentGroupForm?.group}
        groups={activeSegmentGroups}
        suggestedColor={pickUnusedPaletteColor(activeSegmentGroups)}
        saving={segmentGroupSaving}
        onClose={() => setSegmentGroupForm(null)}
        onSubmit={submitSegmentGroupForm}
      />
      <InventoryTabFormModal
        tab={inventoryTabForm}
        tabs={inventoryTabs}
        onClose={() => setInventoryTabForm(null)}
        onSubmit={submitInventoryTabForm}
      />
      <ManualAssetForm
        open={manualAssetFormOpen}
        saving={manualAssetSaving}
        onClose={() => setManualAssetFormOpen(false)}
        onSubmit={handleCreateManualAsset}
      />
      <GeneralSettingsModal
        open={generalSettingsOpen}
        token={token}
        user={user}
        theme={theme}
        systemMode={systemMode}
        onClose={() => setGeneralSettingsOpen(false)}
        onSystemModeChange={changeSystemMode}
        onToggleTheme={onToggleTheme}
        onLogout={logout}
        notify={notify}
      />
    </main>
    <DragOverlay zIndex={1000} dropAnimation={inventoryDropAnimation} modifiers={[keepDragOverlayNearCursor]}>
      {activeDragMachine ? (
        <AssetDragCompactOverlay
          asset={activeDragMachine}
          segmentColor={activeSegments.find((segment) => segment.id === activeDragMachine?.segmentId)?.color}
          alias={activeDragMachine ? machineAliases[activeDragMachine.id] : ""}
          selected={Boolean(activeDragMachine && selectedAssetIds.has(activeDragMachine.id))}
          selectionCount={activeDragMachine && selectedAssetIds.has(activeDragMachine.id) ? selectedAssetIds.size : 0}
        />
      ) : activeDragSegment ? (
        <SegmentDragOverlay
          segment={activeDragSegment}
          count={activeDragSegmentCount}
          groupName={activeDragSegmentGroupName}
        />
      ) : null}
    </DragOverlay>
    <BulkAssetLabelPrint
      assets={bulkPrintAssets}
      aliases={machineAliases}
      onReadyToPrint={handleBulkPrintReady}
    />
    </DndContext>
  );
}

export default function App() {
  const isPublicSupportPath = ["/abrir-chamado", "/solicitar-suporte"].includes(window.location.pathname);
  const pathAssetId = window.location.pathname.match(/^\/assets\/([^/]+)/)?.[1];
  const assetId = pathAssetId
    ? decodeURIComponent(pathAssetId)
    : new URLSearchParams(window.location.search).get("asset");
  const [token, setToken] = useState(localStorage.getItem(tokenKey));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem(userKey) || "null"));
  const [toast, setToast] = useState({ message: "", tone: "ok" });
  const [theme, setTheme] = useState(() => localStorage.getItem(themeKey) || "light");

  useEffect(() => {
    if (isPublicSupportPath || !token || !user) {
      document.documentElement.dataset.theme = "light";
      clearRuntimeAppearancePreferences();
      return;
    }

    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
    applyStoredGeneralPreferences();
  }, [isPublicSupportPath, theme, token, user]);

  function notify(message, tone = "ok") {
    setToast({ message, tone });
  }

  useEffect(() => {
    function handleAuthExpired() {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      setToken(null);
      setUser(null);
      notify("Sessao expirada. Faca login novamente.", "danger");
    }

    window.addEventListener("it-guardian:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("it-guardian:auth-expired", handleAuthExpired);
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  if (isPublicSupportPath) {
    return <PublicSupportRequest />;
  }

  if (assetId) {
    return <AssetPublicView assetId={assetId} />;
  }

  if (!token || !user) {
    return (
      <>
        <AuthScreen
          notify={notify}
          onAuth={(data) => {
            setToken(data.token);
            setUser(data.user);
          }}
        />
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: "", tone: "ok" })} />
      </>
    );
  }

  return (
    <>
      <Dashboard
        token={token}
        user={user}
        theme={theme}
        notify={notify}
        onToggleTheme={toggleTheme}
        onLogout={() => { setToken(null); setUser(null); }}
      />
      <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: "", tone: "ok" })} />
    </>
  );
}
