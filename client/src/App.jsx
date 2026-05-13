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
  createMonitoringSocket,
  deleteSegment,
  fetchAlertHistory,
  fetchAlerts,
  fetchDevice,
  fetchDevices,
  fetchSegments,
  login,
  removeAlertAcknowledgement,
  renameSegment,
  register,
  refreshAssetPing,
  updateDeviceType,
  updateDeviceSegment
} from "./api.js";
import AssetPublicView from "./components/inventory/AssetPublicView.jsx";
import InventoryBoard from "./components/inventory/InventoryBoard.jsx";
import ManualAssetForm from "./components/inventory/ManualAssetForm.jsx";
import { MachineCardPreview } from "./components/inventory/MachineCard.jsx";
import SegmentFormModal from "./components/inventory/SegmentFormModal.jsx";
import SidebarSegmentFilter from "./components/inventory/SidebarSegmentFilter.jsx";
import { useInventoryDragAndDrop } from "./components/inventory/useInventoryDragAndDrop.js";

const tokenKey = "it_guardian_token";
const userKey = "it_guardian_user";
const aliasKey = "it_guardian_machine_aliases";
const observationsKey = "it_guardian_machine_observations";
const themeKey = "it_guardian_theme";

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

const inventoryDropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
};

function inventoryCollisionDetection(args) {
  const { pointerCoordinates, droppableContainers, droppableRects } = args;

  if (pointerCoordinates) {
    const sidebarCandidates = droppableContainers
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

  return closestCenter(args);
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

function upsertSegmentList(current, segment) {
  if (current.some((item) => item.id === segment.id)) {
    return current.map((item) => (item.id === segment.id ? { ...item, ...segment } : item));
  }

  return [...current, segment];
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
        notify("Sessao expirada. Faca login novamente.", "danger");
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
          <span>{device.pingMessage}</span>
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
  const [selectedInventorySegment, setSelectedInventorySegment] = useState("all");
  const [machineAliases, setMachineAliases] = useState(() =>
    JSON.parse(localStorage.getItem(aliasKey) || "{}")
  );
  const [machineObservations, setMachineObservations] = useState(() =>
    JSON.parse(localStorage.getItem(observationsKey) || "{}")
  );
  const [moveModal, setMoveModal] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [segmentForm, setSegmentForm] = useState(null);
  const [manualAssetFormOpen, setManualAssetFormOpen] = useState(false);
  const [manualAssetSaving, setManualAssetSaving] = useState(false);
  const [activeDragMachine, setActiveDragMachine] = useState(null);
  const [activeDragRect, setActiveDragRect] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarDragActive, setSidebarDragActive] = useState(false);
  const [segmentSaving, setSegmentSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const canAcknowledge = ["admin", "operator"].includes(user.role);
  const canManageInventory = ["admin", "operator"].includes(user.role);
  const sidebarWasCollapsedBeforeDrag = useRef(true);
  const sidebarAutoCloseTimer = useRef(null);
  const dragStartScrollY = useRef(0);

  const alertTrend = useMemo(() => {
    return history.slice(0, 6).reverse().map((alert, index) => ({
      label: `#${index + 1}`,
      critical: alert.severity === "critical" ? 1 : 0,
      warning: alert.severity === "warning" ? 1 : 0
    }));
  }, [history]);
  const filteredInventoryDevices = useMemo(() => allDevices.filter((device) => {
    const term = inventorySearch.trim().toLowerCase();
    if (!term) return true;

    return [
      device.name,
      machineAliases[device.id],
      device.ip,
      device.statusLabel,
      device.segmentName,
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
      .some((value) => value.toLowerCase().includes(term));
  }), [allDevices, inventorySearch, machineAliases]);
  const {
    handleDragEnd: handleInventoryDragEnd,
    machinesBySegment,
    sensors
  } = useInventoryDragAndDrop({
    devices: allDevices,
    filteredDevices: filteredInventoryDevices,
    segments,
    onMoveMachine: handleMoveMachine
  });

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [deviceData, allDeviceData, segmentData, activeAlertData, alertHistoryData] = await Promise.all([
        fetchDevices(token, { search, status }),
        fetchDevices(token),
        fetchSegments(token),
        fetchAlerts(token),
        fetchAlertHistory(token)
      ]);

      setDevices(deviceData.devices);
      setAllDevices(allDeviceData.devices);
      setSegments(segmentData.segments);
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
    const socket = createMonitoringSocket(token);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "monitoring.snapshot") return;

        setSummary(payload.summary);
        setAlerts(payload.alerts);
        setLastUpdated(new Date(payload.updatedAt));
        setAllDevices(payload.devices);
        if (payload.segments) {
          setSegments(payload.segments);
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
  }, [token, search, status]);

  useEffect(() => {
    if (selectedInventorySegment === "all") return;

    const segment = segments.find((item) => item.id === selectedInventorySegment);
    const defaultSegmentIsEmpty =
      segment?.isDefault && !allDevices.some((device) => device.segmentId === selectedInventorySegment);

    if (!segment || defaultSegmentIsEmpty) {
      setSelectedInventorySegment("all");
    }
  }, [allDevices, selectedInventorySegment, segments]);

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

    const target = segments.find((segment) => segment.id === segmentId);
    const previousSegment = { id: machine.segmentId, name: machine.segmentName };

    updateDeviceSegmentInState(machine.id, segmentId, target?.name || "Segmento");
    setMoveModal(null);

    try {
      const response = await updateDeviceSegment(token, machine.id, segmentId);
      updateDeviceSegmentInState(machine.id, response.device.segmentId, response.device.segmentName);
      notify(`${machine.name} movida para ${response.device.segmentName}.`, "ok");
      await loadData(true);
    } catch (error) {
      updateDeviceSegmentInState(machine.id, previousSegment.id, previousSegment.name);
      notify(error.message, "danger");
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

  async function handleCreateManualAsset(payload) {
    setManualAssetSaving(true);
    try {
      const response = await createManualAsset(token, payload);
      upsertDeviceInState(response.device);
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
    const rect = event.active?.rect?.current?.initial;
    dragStartScrollY.current = window.scrollY;
    sidebarWasCollapsedBeforeDrag.current = sidebarCollapsed;
    window.clearTimeout(sidebarAutoCloseTimer.current);
    setSidebarDragActive(true);
    setSidebarCollapsed(false);
    setActiveDragMachine(allDevices.find((device) => device.id === machineId) || null);
    setActiveDragRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  function handleInventoryDragCancel() {
    setActiveDragMachine(null);
    setActiveDragRect(null);
    setSidebarDragActive(false);
    if (sidebarWasCollapsedBeforeDrag.current) {
      window.clearTimeout(sidebarAutoCloseTimer.current);
      sidebarAutoCloseTimer.current = window.setTimeout(() => setSidebarCollapsed(true), 950);
    }
  }

  function animateScrollForDrop(result) {
    if (!result?.moved) return;

    const target = document.getElementById(`inventory-segment-${result.targetSegmentId}`);

    if (target) {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 110);
    }

    window.setTimeout(() => {
      window.scrollTo({ top: dragStartScrollY.current, behavior: "smooth" });
    }, target ? 920 : 260);
  }

  function handleInventoryBoardDragEnd(event) {
    let result = null;
    if (activeView === "inventory") {
      result = handleInventoryDragEnd(event);
    }
    handleInventoryDragCancel();
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

  function handleCreateSegment() {
    setSegmentForm({ mode: "create", segment: null });
  }

  async function submitSegmentForm(name) {
    const cleanName = name.trim();
    const duplicate = segments.some(
      (segment) =>
        segment.id !== segmentForm?.segment?.id &&
        segment.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      notify("Ja existe um segmento com esse nome.", "danger");
      return;
    }

    setSegmentSaving(true);
    try {
      if (segmentForm?.mode === "rename") {
        const response = await renameSegment(token, segmentForm.segment.id, { name: cleanName });
        setSegments((current) =>
          current.map((item) => (item.id === segmentForm.segment.id ? { ...item, name: response.segment.name } : item))
        );
        setAllDevices((current) =>
          current.map((device) =>
            device.segmentId === segmentForm.segment.id ? { ...device, segmentName: response.segment.name } : device
          )
        );
        notify("Segmento renomeado.", "ok");
      } else {
        const response = await createSegment(token, { name: cleanName, color: pickSegmentColor(segments) });
        setSegments((current) => upsertSegmentList(current, response.segment));
        notify(`Segmento ${response.segment.name} criado.`, "ok");
      }
      setSegmentForm(null);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentSaving(false);
    }
  }

  function handleRenameSegment(segment) {
    setSegmentForm({ mode: "rename", segment });
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
      notify("Segmento excluido. Maquinas movidas para Nao organizadas.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    onLogout();
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={inventoryCollisionDetection}
      onDragStart={handleInventoryDragStart}
      onDragEnd={handleInventoryBoardDragEnd}
      onDragCancel={handleInventoryDragCancel}
    >
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarDragActive ? "sidebar-drag-active" : ""}`}>
      <aside className="sidebar">
        <button
          type="button"
          className="brand-mark compact sidebar-brand-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
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
          {activeView === "inventory" && !sidebarCollapsed && (
            <SidebarSegmentFilter
              devices={allDevices}
              segments={segments}
              selectedSegmentId={selectedInventorySegment}
              onSelectSegment={setSelectedInventorySegment}
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
                <SummaryCard icon={WifiOff} label="Offline" value={summary.offline} tone="danger" />
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
                <option value="offline">Offline</option>
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
            devices={allDevices}
            segments={segments}
            machinesBySegment={machinesBySegment}
            search={inventorySearch}
            setSearch={setInventorySearch}
            selectedSegmentId={selectedInventorySegment}
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
        segments={segments}
        saving={segmentSaving}
        onClose={() => setSegmentForm(null)}
        onSubmit={submitSegmentForm}
      />
      <ManualAssetForm
        open={manualAssetFormOpen}
        saving={manualAssetSaving}
        onClose={() => setManualAssetFormOpen(false)}
        onSubmit={handleCreateManualAsset}
      />
    </main>
    <DragOverlay zIndex={1000} dropAnimation={inventoryDropAnimation}>
      <MachineCardPreview
        machine={activeDragMachine}
        segments={segments}
        canManage={canManageInventory}
        segmentColor={segments.find((segment) => segment.id === activeDragMachine?.segmentId)?.color}
        alias={activeDragMachine ? machineAliases[activeDragMachine.id] : ""}
        overlayStyle={activeDragRect ? { width: activeDragRect.width, minHeight: activeDragRect.height } : undefined}
      />
    </DragOverlay>
    </DndContext>
  );
}

export default function App() {
  const assetId = new URLSearchParams(window.location.search).get("asset");
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
