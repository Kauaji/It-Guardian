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
  RefreshCw,
  Search,
  Server,
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
  deleteSegment,
  deleteSegmentGroup as deleteSegmentGroupApi,
  fetchAlertHistory,
  fetchAlerts,
  fetchDevice,
  fetchDevices,
  fetchSegmentGroups,
  fetchSegments,
  login,
  removeAlertAcknowledgement,
  renameSegment,
  register,
  refreshAssetPing,
  updateSegmentGroup,
  updateDeviceType,
  updateDeviceSegment
} from "./api.js";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import AssetDragCompactOverlay from "./components/inventory/AssetDragCompactOverlay.jsx";
import BulkAssetLabelPrint from "./components/inventory/BulkAssetLabelPrint.jsx";
import InventoryBoard from "./components/inventory/InventoryBoard.jsx";
import ManualAssetForm from "./components/inventory/ManualAssetForm.jsx";
import SegmentDragOverlay from "./components/inventory/SegmentDragOverlay.jsx";
import SegmentFormModal from "./components/inventory/SegmentFormModal.jsx";
import SegmentGroupFormModal from "./components/inventory/SegmentGroupFormModal.jsx";
import SidebarSegmentFilter from "./components/inventory/SidebarSegmentFilter.jsx";
import { useInventoryDragAndDrop } from "./components/inventory/useInventoryDragAndDrop.js";
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

const defaultInventoryTab = {
  id: "tab-default",
  name: "Sem nome",
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

function readStoredJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeInventoryTabs(value) {
  const tabs = Array.isArray(value) && value.length ? value : [defaultInventoryTab];
  return tabs
    .map((tab, index) => ({
      ...defaultInventoryTab,
      ...tab,
      id: tab.id || `tab-${index}`,
      name: tab.name || "Sem nome",
      color: tab.color || segmentPalette[index % segmentPalette.length],
      order: Number.isFinite(tab.order) ? tab.order : index
    }))
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

  const machineContainers = droppableContainers.filter(
    (container) =>
      container.data.current?.type !== "segment-group-drop" &&
      container.data.current?.type !== "sidebar-segment-group-drop"
  );

  if (pointerCoordinates) {
    const sidebarCandidates = machineContainers
      .filter((container) => container.data.current?.type === "sidebar-segment")
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

function applyInventoryLocalState(devices, removedPeripherals, peripheralHistory) {
  return devices.map((device) => {
    const removed = new Set(removedPeripherals[device.id] || []);
    const peripherals = device.hardware?.peripherals || [];

    return {
      ...device,
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
    password: "admin123"
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
          <span>{isManualAsset ? "Patrimonio" : "Memoria"}</span>
          <strong>{isManualAsset ? device.hardware?.assetTag : `${device.hardware?.ramGb} GB`}</strong>
        </div>
        <div>
          <span>Uptime</span>
          <strong>{device.uptimeHours} h</strong>
        </div>
        <div>
          <span>Inventario</span>
          <strong>{formatDate(device.hardware?.lastInventoryAt)}</strong>
        </div>
      </div>

      <div className="software-list">
        {device.hardware?.software.map((software) => <span key={software}>{software}</span>)}
      </div>
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
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const canAcknowledge = ["admin", "operator"].includes(user.role);
  const canManageInventory = ["admin", "operator"].includes(user.role);
  const sidebarWasCollapsedBeforeDrag = useRef(true);
  const sidebarAutoCloseTimer = useRef(null);
  const dragStartScrollY = useRef(0);

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

  function updateDeviceTabOwnership(deviceIds, targetSegment) {
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
            tabId: activeInventoryTab.id
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
        const isGlobalUnorganized = defaultSegmentIds.has(device.segmentId);

        return {
          ...device,
          tabId: isGlobalUnorganized ? "global-unorganized" : itemTabId("devices", device.id),
          isGlobalUnorganized,
          order: itemOrder("devices", device.id, index)
        };
      }),
    [allDevices, defaultSegmentIds, fallbackInventoryTabId, inventoryTabMeta]
  );
  const activeAllDevices = useMemo(
    () => decoratedAllDevices.filter((device) => device.isGlobalUnorganized || device.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedAllDevices]
  );
  const activeSegmentGroups = useMemo(
    () => decoratedSegmentGroups.filter((group) => group.tabId === activeInventoryTab.id),
    [activeInventoryTab.id, decoratedSegmentGroups]
  );
  const activeSegments = useMemo(() => {
    const activeNonDefaultSegments = decoratedSegments.filter(
      (segment) => !segment.isDefault && segment.tabId === activeInventoryTab.id
    );
    const sharedDefaultSegments = decoratedSegments.filter((segment) => segment.isDefault);

    return [...sharedDefaultSegments, ...activeNonDefaultSegments];
  }, [activeInventoryTab.id, decoratedSegments]);
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
      const [deviceData, allDeviceData, segmentData, groupData, activeAlertData, alertHistoryData] = await Promise.all([
        fetchDevices(token, { search, status }),
        fetchDevices(token),
        fetchSegments(token),
        fetchSegmentGroups(token),
        fetchAlerts(token),
        fetchAlertHistory(token)
      ]);

      const nextDevices = applyInventoryLocalState(deviceData.devices, removedPeripherals, peripheralHistory);
      const nextAllDevices = applyInventoryLocalState(allDeviceData.devices, removedPeripherals, peripheralHistory);
      const nextGroups = groupData.groups || [];
      const nextSegments = applySegmentGroups(segmentData.segments, nextGroups);
      setDevices(nextDevices);
      setAllDevices(nextAllDevices);
      setSegmentGroups(nextGroups);
      setSegments(nextSegments);
      setSummary(deviceData.summary);
      setAlerts(activeAlertData.alerts);
      setHistory(alertHistoryData.alerts);
      setLastUpdated(new Date());

      const visibleForSelection = activeView === "dashboard" ? deviceData.devices : allDeviceData.devices;
      const selectedStillVisible = visibleForSelection.some((device) => device.id === selectedId);
      const nextId = selectedStillVisible ? selectedId : visibleForSelection[0]?.id;
      setSelectedId(nextId);
      if (nextId) {
        const details = await fetchDevice(token, nextId);
        setSelectedDevice(details.device);
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
        notify("Nao foi possivel processar o streaming em tempo real.", "danger");
      }
    };

    socket.onclose = (event) => {
      if (event.code === 1008) {
        notify("Sessao de streaming nao autorizada.", "danger");
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

  function updateDeviceSegmentInState(deviceId, segmentId, segmentName) {
    const update = (device) =>
      device.id === deviceId ? { ...device, segmentId, segmentName } : device;

    setAllDevices((current) => current.map(update));
    setDevices((current) => current.map(update));
    setSelectedDevice((current) => (current?.id === deviceId ? update(current) : current));
  }

  async function handleMoveMachine(machine, segmentId) {
    if (!machine || !segmentId || machine.segmentId === segmentId) {
      setMoveModal(null);
      return;
    }

    if (selectedAssetIds.has(machine.id) && selectedAssetIds.size > 1) {
      await handleMoveMachines(Array.from(selectedAssetIds), segmentId);
      return;
    }

    const target = activeSegments.find((segment) => segment.id === segmentId) || segments.find((segment) => segment.id === segmentId);
    const previousSegment = { id: machine.segmentId, name: machine.segmentName };

    updateDeviceTabOwnership(machine.id, target);
    updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    setMoveModal(null);

    try {
      const response = await updateDeviceSegment(token, machine.id, segmentId);
      updateDeviceSegmentInState(machine.id, response.device.segmentId, response.device.segmentName);
      notify(`${machine.name} movida para ${response.device.segmentName}.`, "ok");
      await loadData(true);
      clearAssetSelection();
    } catch (error) {
      updateDeviceTabOwnership(machine.id, activeSegments.find((segment) => segment.id === previousSegment.id) || segments.find((segment) => segment.id === previousSegment.id));
      updateDeviceSegmentInState(machine.id, previousSegment.id, previousSegment.name);
      notify(error.message, "danger");
    }
  }

  async function handleMoveMachines(machineIds, segmentId) {
    if (!machineIds.length || !segmentId) return;

    const target = activeSegments.find((segment) => segment.id === segmentId) || segments.find((segment) => segment.id === segmentId);
    const machinesToMove = activeAllDevices.filter(
      (device) => machineIds.includes(device.id) && device.segmentId !== segmentId
    );

    if (!machinesToMove.length) {
      clearAssetSelection();
      return;
    }

    const previous = new Map(machinesToMove.map((machine) => [
      machine.id,
      { id: machine.segmentId, name: machine.segmentName }
    ]));

    updateDeviceTabOwnership(machinesToMove.map((machine) => machine.id), target);
    machinesToMove.forEach((machine) => {
      updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    });
    setMoveModal(null);

    try {
      await Promise.all(machinesToMove.map((machine) => updateDeviceSegment(token, machine.id, segmentId)));
      notify(`${machinesToMove.length} equipamentos movidos para ${target?.name || "Segmento"}.`, "ok");
      await loadData(true);
      clearAssetSelection();
    } catch (error) {
      machinesToMove.forEach((machine) => {
        const fallback = previous.get(machine.id);
        updateDeviceTabOwnership(machine.id, activeSegments.find((segment) => segment.id === fallback.id) || segments.find((segment) => segment.id === fallback.id));
        updateDeviceSegmentInState(machine.id, fallback.id, fallback.name);
      });
      notify(error.message, "danger");
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
    const nextColor = color || pickSegmentColor(activeSegmentGroups);
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
      `Excluir o segmento "${segment.name}"? As maquinas vao voltar para Nao organizadas.`
    );
    if (!confirmed) return;

    try {
      await deleteSegment(token, segment.id);
      saveSegmentGroups(assignSegmentToGroup(segmentGroups, segment.id, ""));
      setSegments((current) => current.filter((item) => item.id !== segment.id));
      notify("Segmento excluido. Maquinas movidas para Nao organizadas.", "ok");
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
    const nextNumber = inventoryTabs.length + 1;
    const cleanName = `Novo ambiente ${nextNumber}`;

    const nextTab = {
      id: `tab-${Date.now()}`,
      name: cleanName,
      color: pickSegmentColor(inventoryTabs),
      order: inventoryTabs.length
    };

    saveInventoryTabs([...inventoryTabs, nextTab]);
    setActiveInventoryTabId(nextTab.id);
    notify(`Ambiente ${nextTab.name} criado.`, "ok");
  }

  function renameInventoryTab(tabId) {
    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    const name = window.prompt("Nome da aba/ambiente", tab.name);
    const cleanName = name?.trim();
    if (!cleanName) return;

    saveInventoryTabs(inventoryTabs.map((item) => (item.id === tabId ? { ...item, name: cleanName } : item)));
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
        onMouseEnter={() => setSidebarHoverOpen(true)}
        onMouseLeave={() => {
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
          <button className={activeView === "dashboard" ? "nav-active" : ""} onClick={() => setActiveView("dashboard")}>
            <Activity size={18} /> <span className="nav-label">Dashboard</span>
          </button>
          <button className={activeView === "alerts" ? "nav-active" : ""} onClick={() => setActiveView("alerts")}>
            <AlertTriangle size={18} /> <span className="nav-label">Alertas</span>
          </button>
          <button className={activeView === "inventory" ? "nav-active" : ""} onClick={() => setActiveView("inventory")}>
            <Database size={18} /> <span className="nav-label">Inventario</span>
          </button>
          {activeView === "inventory" && sidebarExpanded && (
            <SidebarSegmentFilter
              devices={activeAllDevices}
              segments={activeSegments}
              groups={activeSegmentGroups}
              selectedGroupId={selectedInventoryGroup}
              selectedSegmentId={selectedInventorySegment}
              onSelectGroup={selectInventoryGroup}
              onSelectSegment={selectInventorySegment}
              onToggleGroup={toggleSegmentGroup}
            />
          )}
        </nav>
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

        {activeView === "dashboard" && (
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
                  <h2>Maquinas monitoradas</h2>
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
                  <h2>Historico de alertas</h2>
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

        {activeView === "alerts" && (
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

        {activeView === "inventory" && (
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
            onClearSelection={clearAssetSelection}
            onSelectAsset={handleSelectAsset}
            onToggleSelection={toggleAssetSelection}
            groups={activeSegmentGroups}
            onSelectGroup={selectInventoryGroup}
            onCreateGroup={openSegmentGroupForm}
            onRenameGroup={renameSegmentGroup}
            onDeleteGroup={deleteSegmentGroup}
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
            onCloseMoveModal={() => setMoveModal(null)}
            onOpenMoveModal={openMoveModal}
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
        saving={segmentGroupSaving}
        onClose={() => setSegmentGroupForm(null)}
        onSubmit={submitSegmentGroupForm}
      />
      <ManualAssetForm
        open={manualAssetFormOpen}
        saving={manualAssetSaving}
        onClose={() => setManualAssetFormOpen(false)}
        onSubmit={handleCreateManualAsset}
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
  const pathAssetId = window.location.pathname.match(/^\/assets\/([^/]+)/)?.[1];
  const assetId = pathAssetId
    ? decodeURIComponent(pathAssetId)
    : new URLSearchParams(window.location.search).get("asset");
  const [token, setToken] = useState(localStorage.getItem(tokenKey));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem(userKey) || "null"));
  const [toast, setToast] = useState({ message: "", tone: "ok" });
  const [theme, setTheme] = useState(() => localStorage.getItem(themeKey) || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  function notify(message, tone = "ok") {
    setToast({ message, tone });
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
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
