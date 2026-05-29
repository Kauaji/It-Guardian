import { useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  Cpu,
  Database,
  HardDrive,
  LogOut,
  MemoryStick,
  Monitor,
  Moon,
  Network,
  PanelLeftClose,
  ClipboardList,
  RefreshCw,
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
  acknowledgeAlert,
  createManualAsset,
  createSegment,
  createSegmentGroup as createSegmentGroupApi,
  createMonitoringSocket,
  deleteDevice,
  deleteServiceOrder,
  deleteSegment,
  deleteSegmentGroup as deleteSegmentGroupApi,
  fetchAlertHistory,
  fetchAlerts,
  fetchDevice,
  fetchDevices,
  fetchServiceOrders,
  fetchSegmentGroups,
  fetchSegments,
  fetchSystemSettings,
  login,
  removeAlertAcknowledgement,
  renameSegment,
  register,
  refreshAssetPing,
  createServiceOrder,
  addServiceOrderHistory,
  updateServiceOrder,
  updateServiceOrderStatus,
  updateDeviceBackup,
  updateSegmentGroup,
  updateDeviceType,
  updateDeviceSegment,
  updateSystemSettings
} from "./api.js";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import AssetDragCompactOverlay from "./components/inventory/AssetDragCompactOverlay.jsx";
import BulkAssetLabelPrint from "./components/inventory/BulkAssetLabelPrint.jsx";
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
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "admin@itguardian.local",
    password: "123456"
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

function AlertList({ alerts, canAcknowledge, onAcknowledge }) {
  return (
    <section className="panel alerts-panel">
      <div className="panel-heading">
        <h2>Alertas ativos</h2>
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
              {canAcknowledge && !alert.acknowledgement && (
                <button className="ack-button" onClick={() => onAcknowledge(alert.id)}>
                  <CheckCircle size={14} />
                  Resolver
                </button>
              )}
            </div>
          </article>
        ))}
        {!alerts.length && <p className="empty">Nenhum alerta ativo.</p>}
      </div>
    </section>
  );
}

function AlertCenter({
  alerts,
  history,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  canAcknowledge,
  onAcknowledge,
  onRemoveAcknowledgement
}) {
  const visibleAlerts = history.filter((alert) => {
    const severityMatches = severityFilter === "all" || alert.severity === severityFilter;
    const statusMatches =
      statusFilter === "all" ||
      (statusFilter === "active" && !isAlertResolved(alert)) ||
      (statusFilter === "resolved" && isAlertResolved(alert));

    return severityMatches && statusMatches;
  });
  const criticalAlerts = history.filter((alert) => alert.severity === "critical").length;
  const resolvedAlerts = history.filter(isAlertResolved).length;

  return (
    <section className="view-stack">
      <section className="summary-grid compact-summary alerts-summary">
        <SummaryCard icon={Bell} label="Alertas ativos" value={alerts.length} tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Criticos" value={criticalAlerts} tone="danger" />
        <SummaryCard icon={CheckCircle} label="Resolvidos" value={resolvedAlerts} tone="ok" />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Central de alertas</h2>
            <p>Eventos ativos e historico retornados pelo Zabbix</p>
          </div>
          <Bell size={18} />
        </div>
        <div className="toolbar inline-toolbar">
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">Todas as severidades</option>
            <option value="critical">Critico</option>
            <option value="warning">Atencao</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos os estados</option>
            <option value="active">Ativos</option>
            <option value="resolved">Resolvidos</option>
          </select>
        </div>

        <div className="alert-board">
          {visibleAlerts.map((alert) => (
            <article key={alert.id} className={`alert-card ${alert.severity}`}>
              <div>
                <span className={`pill ${isAlertResolved(alert) ? "ok" : "warning"}`}>
                  {isAlertResolved(alert) ? "Resolvido" : "Ativo"}
                </span>
                <span className={`pill ${alert.severity === "critical" ? "danger" : "warning"}`}>
                  {alert.severity === "critical" ? "Critico" : "Atencao"}
                </span>
              </div>
              <h3>{alert.title}</h3>
              <p>{alert.description}</p>
              <dl>
                <div>
                  <dt>Host</dt>
                  <dd>{alert.hostName}</dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{formatDate(alert.startedAt)}</dd>
                </div>
                <div>
                  <dt>Resolucao</dt>
                  <dd>{formatDate(alert.resolvedAt)}</dd>
                </div>
              </dl>
              <div className="resolve-actions" aria-label="Estado de resolucao">
                {isAlertResolved(alert) && (
                  <span className="resolve-indicator" title="Resolvido">
                    <CheckCircle size={17} />
                  </span>
                )}
                {canAcknowledge && alert.status === "active" && !alert.acknowledgement && (
                  <button className="resolve-icon-button" onClick={() => onAcknowledge(alert.id)} title="Marcar como resolvido">
                    <CheckCircle size={17} />
                  </button>
                )}
                {canAcknowledge && alert.acknowledgement && (
                  <button className="resolve-icon-button danger" onClick={() => onRemoveAcknowledgement(alert.id)} title="Remover resolvido">
                    <XCircle size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
          {!visibleAlerts.length && <p className="empty">Nenhum alerta encontrado para os filtros atuais.</p>}
        </div>
      </section>
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
  const [serviceOrders, setServiceOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState("all");
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
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const canViewDashboard = hasPermission(user, "dashboard.view");
  const canViewAlerts = canViewDashboard;
  const canViewInventory = hasPermission(user, "inventory.view");
  const canViewMachine = hasPermission(user, "inventory.view_machine");
  const canViewServiceOrders = hasPermission(user, "service_orders.view");
  const canOpenGeneralSettings =
    hasPermission(user, "settings.general") ||
    hasPermission(user, "settings.appearance") ||
    hasPermission(user, "settings.system_mode") ||
    hasPermission(user, "admin.full");
  const permittedViewIds = useMemo(() => {
    const views = [];
    if (canViewDashboard) views.push("dashboard");
    if (canViewAlerts) views.push("alerts");
    if (canViewServiceOrders) views.push("service-orders");
    if (canViewInventory) views.push("inventory");
    return views;
  }, [canViewAlerts, canViewDashboard, canViewInventory, canViewServiceOrders]);
  const canAcknowledge = canViewAlerts && ["admin", "operator"].includes(user.role);
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

  function saveInventoryTabs(nextTabs) {
    const normalized = normalizeInventoryTabs(nextTabs);
    setInventoryTabs(normalized);
    localStorage.setItem(inventoryTabsKey, JSON.stringify(normalized));
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
        serviceOrderData,
        systemSettingsData
      ] = await Promise.all([
        canViewInventory ? fetchDevices(token, { search, status }) : Promise.resolve({ devices: [], summary: null }),
        canViewInventory ? fetchDevices(token) : Promise.resolve({ devices: [] }),
        canViewInventory ? fetchSegments(token) : Promise.resolve({ segments: [] }),
        canViewInventory ? fetchSegmentGroups(token) : Promise.resolve({ groups: [] }),
        canViewAlerts ? fetchAlerts(token) : Promise.resolve({ alerts: [] }),
        canViewAlerts ? fetchAlertHistory(token) : Promise.resolve({ alerts: [] }),
        canViewServiceOrders ? fetchServiceOrders(token) : Promise.resolve({ serviceOrders: [] }),
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
      setServiceOrders(serviceOrderData.serviceOrders || []);
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
        activeAlertData.alerts.some((alert) => alert.severity === "critical" && !alert.acknowledgement)
      ) {
        notify("Existem alertas criticos pendentes.", "danger");
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
              oldValue: asset.segmentName || "Manutencao"
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
      name: "Manutencao",
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
          title: `Manutencao - ${machine.name}`,
          description: `Máquina ${machine.name} colocada em manutenção. Preencha o diagnóstico, atendimento e solução antes de finalizar.`,
          priority: "medium",
          category: "Manutencao",
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
      oldValue: machine.segmentName || "Manutencao",
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

    saveInventoryTabs([...inventoryTabs, nextTab]);
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

    saveInventoryTabs(inventoryTabs.map((item) => (item.id === tabId ? { ...item, name: cleanName } : item)));
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
    saveInventoryTabs(inventoryTabs.map((tab) => (tab.id === tabId ? { ...tab, color } : tab)));
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
          {canViewAlerts && (
            <button className={activeView === "alerts" ? "nav-active" : ""} onClick={() => setActiveView("alerts")}>
              <AlertTriangle size={18} /> <span className="nav-label">Alertas</span>
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
                <SummaryCard icon={AlertTriangle} label="Criticos" value={summary.criticalAlerts} tone="danger" />
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
              <AlertList alerts={alerts} canAcknowledge={canAcknowledge} onAcknowledge={handleAcknowledge} />
            </section>

            <section className="bottom-grid">
              <DeviceDetails device={selectedDevice} />
              <section className="panel history-panel">
                <div className="panel-heading">
                  <h2>Histórico de alertas</h2>
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

        {activeView === "alerts" && canViewAlerts && (
          <AlertCenter
            alerts={alerts}
            history={history}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            statusFilter={alertStatusFilter}
            setStatusFilter={setAlertStatusFilter}
            canAcknowledge={canAcknowledge}
            onAcknowledge={handleAcknowledge}
            onRemoveAcknowledgement={handleRemoveAcknowledgement}
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
