import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchClients,
  fetchSectors,
  fetchServiceOrderSettings,
  fetchTechnicians,
  updateServiceOrderSettings
} from "../../api.js";
import SettingsView from "../settings/SettingsView.jsx";
import ServiceOrderDetailsModal from "./ServiceOrderDetailsModal.jsx";
import ServiceOrderFormModal from "./ServiceOrderFormModal.jsx";

const defaultPriorityColors = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626"
};

const serviceOrderNumberDigits = 4;
const defaultServiceOrderStatuses = [
  { id: "open", name: "Aberta", color: "#2563eb", order: 0, isInitial: true, isFinal: false },
  { id: "in_progress", name: "Em atendimento", color: "#d97706", order: 1, isInitial: false, isFinal: false },
  { id: "waiting", name: "Aguardando", color: "#7c3aed", order: 2, isInitial: false, isFinal: false },
  { id: "closed", name: "Finalizada", color: "#16a34a", order: 3, isInitial: false, isFinal: true }
];

const defaultServiceOrderSettings = {
  numberFormat: {
    prefix: "OS",
    useYear: false,
    useMonth: false,
    nextNumber: ""
  },
  autoPriority: {
    enabled: false,
    lowToMediumHours: 24,
    mediumToHighHours: 48,
    highToCriticalHours: 72
  },
  statuses: defaultServiceOrderStatuses,
  priorityColors: defaultPriorityColors,
  boardLayout: "horizontal"
};

const settingsTabs = [
  { id: "general", label: "Geral" },
  { id: "clients", label: "Clientes" },
  { id: "technicians", label: "Técnicos" },
  { id: "products", label: "Peças" },
  { id: "services", label: "Serviços" },
  { id: "problemTypes", label: "Tipos de problema" }
];

const maxServiceOrderStatuses = 10;
const generalSector = { id: "sector-geral", name: "Geral", active: true };

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getMonthValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCurrentBrowserMonth() {
  return getMonthValue(new Date());
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeSectorList(sectors = []) {
  const byId = new Map([[generalSector.id, generalSector]]);
  for (const sector of sectors) {
    if (!sector?.id) continue;
    byId.set(sector.id, sector);
  }
  return [...byId.values()].filter((sector) => sector.active !== false);
}

function orderBelongsToSector(order, sectorId) {
  if (sectorId === generalSector.id) {
    return !order.sectorId || order.sectorId === generalSector.id || order.sectorName === generalSector.name;
  }
  return order.sectorId === sectorId;
}

function orderBelongsToClient(order, clientId) {
  if (!clientId || clientId === "all") return true;
  return order.environmentId === clientId;
}

function getServiceLabel(order = {}) {
  if (order.serviceCode && order.serviceName) return `${order.serviceCode} - ${order.serviceName}`;
  return order.serviceName || order.serviceCode || order.servicePerformed || "";
}

function formatMonthFilterLabel(value) {
  if (!value) return "Todos os meses";
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Selecionar mês";
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatShortMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function buildServiceOrderNumberPreview(settings) {
  const numberFormat = settings.numberFormat || defaultServiceOrderSettings.numberFormat;
  const prefix = String(numberFormat.prefix || "OS").trim().toUpperCase() || "OS";
  const sequence = Number(numberFormat.nextNumber) || 1;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return [
    prefix,
    numberFormat.useYear ? year : "",
    numberFormat.useMonth ? month : "",
    String(sequence).padStart(serviceOrderNumberDigits, "0")
  ]
    .filter(Boolean)
    .join("-");
}

function normalizeStatuses(statuses = []) {
  const source = Array.isArray(statuses) && statuses.length ? statuses : defaultServiceOrderStatuses;
  const seen = new Set();
  const normalized = source
    .map((status, index) => {
      const fallback = defaultServiceOrderStatuses[index] || defaultServiceOrderStatuses.at(-1);
      const id = String(status.id || status.value || fallback.id).trim() || fallback.id;
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: String(status.name || status.label || fallback.name).trim() || fallback.name,
        color: /^#[0-9a-f]{6}$/i.test(status.color || "") ? status.color : fallback.color,
        order: Number.isFinite(Number(status.order)) ? Number(status.order) : index,
        isInitial: Boolean(status.isInitial),
        isFinal: Boolean(status.isFinal)
      };
    })
    .filter(Boolean);

  for (const status of defaultServiceOrderStatuses) {
    if (normalized.length >= 2) break;
    if (!seen.has(status.id)) normalized.push({ ...status });
  }

  normalized.sort((a, b) => a.order - b.order);

  let initialIndex = normalized.findIndex((status) => status.isInitial);
  if (initialIndex < 0) initialIndex = Math.max(0, normalized.findIndex((status) => status.id === "open"));
  if (initialIndex < 0) initialIndex = 0;

  let finalIndex = normalized.findIndex((status) => status.isFinal);
  if (finalIndex < 0) finalIndex = normalized.findIndex((status) => status.id === "closed");
  if (finalIndex < 0) finalIndex = normalized.length - 1;
  if (normalized.length > 1 && finalIndex === initialIndex) {
    finalIndex = normalized.findIndex((_status, index) => index !== initialIndex);
  }

  return normalized.map((status, index) => ({
    ...status,
    order: index,
    isInitial: index === initialIndex,
    isFinal: index === finalIndex
  }));
}

function mergeServiceOrderSettings(settings = {}) {
  return {
    numberFormat: {
      ...defaultServiceOrderSettings.numberFormat,
      ...(settings.numberFormat || {})
    },
    autoPriority: {
      ...defaultServiceOrderSettings.autoPriority,
      ...(settings.autoPriority || {})
    },
    statuses: normalizeStatuses(settings.statuses),
    priorityColors: {
      ...defaultPriorityColors,
      ...(settings.priorityColors || {})
    },
    boardLayout: settings.boardLayout === "vertical" ? "vertical" : "horizontal"
  };
}

function ServiceOrderCard({ order, asset, priorityColor, businessMode, dragging, onDragStart, onDragEnd, onOpen }) {
  const priorityBackground = `color-mix(in srgb, ${priorityColor} 32%, var(--surface))`;
  const mainContext = businessMode ? order.environmentName || "Sem cliente" : order.sectorName || "Geral";
  const secondaryContext = businessMode ? order.sectorName || "Geral" : getServiceLabel(order);

  return (
    <button
      type="button"
      className={`service-order-card priority-${order.priority} ${dragging ? "is-dragging" : ""}`}
      style={{
        "--service-order-priority-color": priorityColor,
        "--service-order-priority-bg": priorityBackground
      }}
      draggable
      title={order.title}
      onClick={() => onOpen(order)}
      onDragStart={(event) => onDragStart(event, order)}
      onDragEnd={onDragEnd}
    >
      <span>{order.number}</span>
      <strong title={order.title}>{order.title}</strong>
      <small title={asset?.name || "Sem ativo vinculado"}>{asset?.name || "Sem ativo vinculado"}</small>
      <div>
        <em title={priorityLabels[order.priority]}>{priorityLabels[order.priority]}</em>
        <em title={mainContext}>{mainContext}</em>
        {secondaryContext && <em title={secondaryContext}>{secondaryContext}</em>}
      </div>
      <footer>
        <UserRound size={14} />
        <span title={order.assignedTechnicianName || "Sem técnico"}>{order.assignedTechnicianName || "Sem técnico"}</span>
        <time>{formatDate(order.createdAt)}</time>
      </footer>
    </button>
  );
}

function SettingsAccordionSection({ id, title, description, activeSection, onToggle, children }) {
  const open = activeSection === id;
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <section className={`service-order-settings-accordion ${open ? "open" : ""}`}>
      <button
        type="button"
        className="service-order-settings-accordion-trigger"
        onClick={() => onToggle(open ? "" : id)}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        <Icon size={18} />
      </button>
      {open && <div className="service-order-settings-accordion-body">{children}</div>}
    </section>
  );
}

export default function ServiceOrdersBoard({
  serviceOrders = [],
  devices = [],
  segments = [],
  tabs = [],
  activeTab,
  token,
  notify,
  systemMode = "local",
  saving,
  onCreate,
  onUpdate,
  onAddHistory,
  onStatusChange,
  onDelete,
  onSelectBackup,
  onReleaseBackup,
  permissions = {},
  user = null
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [generalSettingsSection, setGeneralSettingsSection] = useState("");
  const [showPriorityColorConfig, setShowPriorityColorConfig] = useState(false);
  const [serviceOrderSettings, setServiceOrderSettings] = useState(defaultServiceOrderSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [priorityColors, setPriorityColors] = useState(defaultPriorityColors);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [draggingOrderId, setDraggingOrderId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState("");
  const [monthFilter, setMonthFilter] = useState(getCurrentBrowserMonth);
  const [orderSearch, setOrderSearch] = useState("");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerMode, setMonthPickerMode] = useState("months");
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sectors, setSectors] = useState([generalSector]);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const canCreateOrders = permissions.create ?? true;
  const canManageSettings = permissions.settings ?? true;
  const canChangeStatus = permissions.changeStatus ?? true;
  const canFinishOrders = permissions.finish ?? canChangeStatus;
  const canViewAllSectors = permissions.viewAll ?? false;
  const canViewAllClients = permissions.viewAll ?? false;
  const canChangeSector = permissions.changeSector ?? permissions.edit ?? false;
  const assetById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices]
  );
  const selectedOrderCurrent = selectedOrder
    ? serviceOrders.find((order) => order.id === selectedOrder.id) || selectedOrder
    : null;
  const businessMode = systemMode === "business";
  const configuredStatuses = useMemo(
    () => normalizeStatuses(serviceOrderSettings.statuses),
    [serviceOrderSettings.statuses]
  );
  const finalStatusIds = useMemo(
    () => new Set(configuredStatuses.filter((status) => status.isFinal).map((status) => status.id)),
    [configuredStatuses]
  );
  const availableSectors = useMemo(() => normalizeSectorList(sectors), [sectors]);
  const monthFilteredServiceOrders = useMemo(
    () => monthFilter
      ? serviceOrders.filter((order) => {
          const createdMonth = getMonthValue(order.createdAt);
          const isFinalized = Boolean(order.closedAt) || finalStatusIds.has(order.status);
          return createdMonth === monthFilter || (!isFinalized && createdMonth && createdMonth <= monthFilter);
        })
      : serviceOrders,
    [finalStatusIds, serviceOrders, monthFilter]
  );
  const sectorFilteredServiceOrders = useMemo(() => {
    if (sectorFilter === "all" && canViewAllSectors) return monthFilteredServiceOrders;
    if (sectorFilter === "mine") {
      return monthFilteredServiceOrders.filter((order) =>
        (user?.sectorId && orderBelongsToSector(order, user.sectorId)) ||
        orderBelongsToSector(order, generalSector.id) ||
        order.assignedTechnicianName === user?.name ||
        order.createdBy === user?.id
      );
    }
    return monthFilteredServiceOrders.filter((order) => orderBelongsToSector(order, sectorFilter || generalSector.id));
  }, [canViewAllSectors, monthFilteredServiceOrders, sectorFilter, user?.id, user?.name, user?.sectorId]);
  const catalogFilteredServiceOrders = useMemo(() => {
    let orders = sectorFilteredServiceOrders;

    if (businessMode && clientFilter !== "all") {
      orders = orders.filter((order) => orderBelongsToClient(order, clientFilter));
    }

    if (priorityFilter !== "all") {
      orders = orders.filter((order) => order.priority === priorityFilter);
    }

    if (technicianFilter !== "all") {
      const technician = normalizeSearchText(technicianFilter);
      orders = orders.filter((order) => normalizeSearchText(order.assignedTechnicianName) === technician);
    }

    if (statusFilter !== "all") {
      orders = orders.filter((order) => order.status === statusFilter);
    }

    return orders;
  }, [
    businessMode,
    clientFilter,
    priorityFilter,
    sectorFilteredServiceOrders,
    statusFilter,
    technicianFilter
  ]);
  const visibleServiceOrders = useMemo(() => {
    const term = normalizeSearchText(orderSearch);
    if (!term) return catalogFilteredServiceOrders;

    return catalogFilteredServiceOrders.filter((order) => {
      const asset = assetById.get(order.assetId);
      const searchable = [
        order.number,
        order.title,
        order.description,
        order.category,
        order.status,
        order.priority,
        order.requesterName,
        order.assignedTechnicianName,
        order.environmentName,
        order.sectorName,
        order.serviceCode,
        order.serviceName,
        order.servicePerformed,
        asset?.name,
        asset?.hostname,
        asset?.ip
      ];

      return searchable.some((value) => normalizeSearchText(value).includes(term));
    });
  }, [assetById, catalogFilteredServiceOrders, orderSearch]);
  const availableMonthValues = useMemo(
    () => [...new Set(serviceOrders.map((order) => getMonthValue(order.createdAt)).filter(Boolean))].sort(),
    [serviceOrders]
  );
  const availableYears = useMemo(
    () => [...new Set(availableMonthValues.map((value) => Number(value.slice(0, 4))))].sort((left, right) => left - right),
    [availableMonthValues]
  );
  const availableMonthsForYear = useMemo(
    () => availableMonthValues.filter((value) => Number(value.slice(0, 4)) === monthPickerYear),
    [availableMonthValues, monthPickerYear]
  );

  useEffect(() => {
    if (!token) return;

    fetchServiceOrderSettings(token)
      .then((response) => {
        const merged = mergeServiceOrderSettings(response.settings);
        setServiceOrderSettings(merged);
        setPriorityColors(merged.priorityColors);
      })
      .catch((error) => notify?.(error.message, "danger"));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchSectors(token)
      .then((response) => setSectors(normalizeSectorList(response.sectors || [])))
      .catch(() => setSectors([generalSector]));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch(() => setTechnicians([]));

    if (businessMode) {
      fetchClients(token)
        .then((response) => setClients((response.clients || []).filter((item) => item.active !== false)))
        .catch(() => setClients([]));
    } else {
      setClients([]);
      setClientFilter("all");
    }
  }, [businessMode, token]);

  useEffect(() => {
    if (canViewAllSectors) return;
    setSectorFilter((current) => (current === "all" ? "mine" : current));
  }, [canViewAllSectors]);

  useEffect(() => {
    if (businessMode && canViewAllClients) return;
    setClientFilter("all");
  }, [businessMode, canViewAllClients]);

  useEffect(() => {
    if (!settingsOpen) return;
    setGeneralSettingsSection("");
    setShowPriorityColorConfig(false);
    setFiltersOpen(false);
  }, [settingsOpen]);

  useEffect(() => {
    if (monthFilter) {
      setMonthPickerYear(Number(monthFilter.slice(0, 4)));
    } else if (availableYears.length) {
      setMonthPickerYear(availableYears.at(-1));
    }
  }, [monthFilter, availableYears]);

  function updateServiceOrderSettingsField(section, field, value) {
    setServiceOrderSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value
      }
    }));
  }

  function updateServiceOrderSetting(field, value) {
    setServiceOrderSettings((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateStatus(statusId, patch) {
    setServiceOrderSettings((current) => ({
      ...current,
      statuses: normalizeStatuses(
        current.statuses.map((status) => (status.id === statusId ? { ...status, ...patch } : status))
      )
    }));
  }

  function addStatus() {
    setServiceOrderSettings((current) => {
      const statuses = normalizeStatuses(current.statuses);
      if (statuses.length >= maxServiceOrderStatuses) {
        notify?.("Limite máximo de 10 status atingido.", "danger");
        return current;
      }
      const nextIndex = statuses.length + 1;
      return {
        ...current,
        statuses: normalizeStatuses([
          ...statuses,
          {
            id: `status_${Date.now()}`,
            name: `Novo status ${nextIndex}`,
            color: "#64748b",
            order: statuses.length,
            isInitial: false,
            isFinal: false
          }
        ])
      };
    });
  }

  function deleteStatus(statusId) {
    const currentStatuses = normalizeStatuses(serviceOrderSettings.statuses);
    const status = currentStatuses.find((item) => item.id === statusId);

    if (!status) return;
    if (currentStatuses.length <= 2) {
      notify?.("Mantenha pelo menos um status de abertura e um de finalização.", "danger");
      return;
    }
    if (serviceOrders.some((order) => order.status === statusId)) {
      notify?.("Mova as OS deste status antes de excluí-lo.", "danger");
      return;
    }
    if (!window.confirm(`Excluir o status "${status.name}"?`)) return;

    setServiceOrderSettings((current) => ({
      ...current,
      statuses: normalizeStatuses(current.statuses.filter((item) => item.id !== statusId))
    }));
  }

  function moveStatus(statusId, direction) {
    setServiceOrderSettings((current) => {
      const statuses = normalizeStatuses(current.statuses);
      const index = statuses.findIndex((status) => status.id === statusId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= statuses.length) return current;

      const reordered = [...statuses];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return {
        ...current,
        statuses: normalizeStatuses(reordered.map((status, order) => ({ ...status, order })))
      };
    });
  }

  function setStatusRole(statusId, role) {
    const currentStatuses = normalizeStatuses(serviceOrderSettings.statuses);
    const roleKey = role === "initial" ? "isInitial" : "isFinal";
    const hasAnother = currentStatuses.some((status) => status[roleKey] && status.id !== statusId);
    const message = role === "initial"
      ? "Já existe um status definido como abertura. Deseja substituir?"
      : "Já existe um status definido como finalização. Deseja substituir?";

    if (hasAnother && !window.confirm(message)) return;

    setServiceOrderSettings((current) => ({
      ...current,
      statuses: normalizeStatuses(
        current.statuses.map((status) => ({
          ...status,
          [roleKey]: status.id === statusId,
          ...(role === "initial" ? {} : {}),
          ...(role === "initial" && status.id === statusId ? { isFinal: false } : {}),
          ...(role === "final" && status.id === statusId ? { isInitial: false } : {})
        }))
      )
    }));
  }

  async function saveServiceOrderSettings() {
    setSettingsSaving(true);
    try {
      const response = await updateServiceOrderSettings(token, serviceOrderSettings);
      const merged = mergeServiceOrderSettings(response.settings);
      setServiceOrderSettings(merged);
      setPriorityColors(merged.priorityColors);
      notify?.("Configurações da OS salvas.", "ok");
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSettingsSaving(false);
    }
  }

  function changePriorityColor(priority, color) {
    setPriorityColors((current) => ({
      ...current,
      [priority]: color
    }));
    setServiceOrderSettings((current) => ({
      ...current,
      priorityColors: {
        ...current.priorityColors,
        [priority]: color
      }
    }));
  }

  function resetPriorityColors() {
    setPriorityColors(defaultPriorityColors);
    setServiceOrderSettings((current) => ({
      ...current,
      priorityColors: defaultPriorityColors
    }));
  }

  function handleDragStart(event, order) {
    setDraggingOrderId(order.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", order.id);
  }

  function handleDragEnd() {
    setDraggingOrderId("");
    setDragOverStatus("");
  }

  async function handleDrop(event, targetStatus) {
    event.preventDefault();

    const orderId = event.dataTransfer.getData("text/plain") || draggingOrderId;
    const order = serviceOrders.find((item) => item.id === orderId);
    handleDragEnd();

    if (!order || order.status === targetStatus) return;
    if (!canChangeStatus) {
      notify?.("Você não possui permissão para alterar status de OS.", "danger");
      return;
    }
    if (configuredStatuses.find((status) => status.id === targetStatus)?.isFinal && !canFinishOrders) {
      notify?.("Você não possui permissão para finalizar esta Ordem de Serviço.", "danger");
      return;
    }
    await onStatusChange(order, targetStatus);
  }

  const visibleSettingsTabs = useMemo(
    () => settingsTabs.filter((tab) => businessMode || tab.id !== "clients"),
    [businessMode]
  );

  useEffect(() => {
    if (!businessMode && settingsTab === "clients") {
      setSettingsTab("general");
    }
  }, [businessMode, settingsTab]);

  return (
    <section className="service-orders-view">
      <header className="service-orders-header">
        <div className="service-orders-heading">
          <div className="service-orders-title-row">
          <h2>Ordens de Serviço</h2>
          <span className={`service-order-mode-badge ${businessMode ? "business" : "internal"}`}>
            {businessMode ? "Modo Business" : "Modo Local"}
          </span>
          </div>
        </div>
        <label className={`service-order-search ${orderSearch ? "has-value" : ""}`}>
          <Search size={16} />
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Pesquisar OS ou técnico"
            aria-label="Pesquisar por ordem de serviço ou técnico"
          />
        </label>
        <div className="service-orders-header-actions">
          <div className="service-order-month-filter" aria-label="Filtro por mês de abertura">
            <button
              type="button"
              className="service-order-month-trigger"
              onClick={() => {
                setFiltersOpen(false);
                setMonthPickerOpen((current) => !current);
              }}
              aria-expanded={monthPickerOpen}
              aria-label="Selecionar mês de abertura"
              title="Selecionar mês"
            >
              <Calendar size={16} />
              <span>{formatMonthFilterLabel(monthFilter)}</span>
            </button>
            {monthPickerOpen && (
              <div className="service-order-month-popover">
                <header className="service-order-month-picker-header">
                  <button
                    type="button"
                    className="ghost-action compact-action"
                    onClick={() => setMonthPickerMode((current) => (current === "years" ? "months" : "years"))}
                  >
                    {monthPickerYear}
                  </button>
                  <span>{monthPickerMode === "years" ? "Selecione o ano" : "Selecione o mês"}</span>
                </header>
                {monthPickerMode === "years" ? (
                  <div className="service-order-year-grid">
                    {availableYears.length ? availableYears.map((year) => (
                      <button
                        key={year}
                        type="button"
                        className={year === monthPickerYear ? "active" : ""}
                        onClick={() => {
                          setMonthPickerYear(year);
                          setMonthPickerMode("months");
                        }}
                      >
                        {year}
                      </button>
                    )) : <p className="empty">Nenhuma OS cadastrada.</p>}
                  </div>
                ) : (
                  <div className="service-order-month-grid">
                    {availableMonthsForYear.length ? availableMonthsForYear.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={value === monthFilter ? "active" : ""}
                        onClick={() => {
                          setMonthFilter(value);
                          setMonthPickerOpen(false);
                        }}
                      >
                        {formatShortMonth(value)}
                      </button>
                    )) : <p className="empty">Sem OS neste ano.</p>}
                  </div>
                )}
                <div className="service-order-month-popover-actions">
                  <button
                    type="button"
                    className="ghost-action compact-action"
                    onClick={() => {
                      setMonthFilter("");
                      setMonthPickerOpen(false);
                    }}
                  >
                    Todos os meses
                  </button>
                  <button type="button" className="primary-action compact-action" onClick={() => setMonthPickerOpen(false)}>
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
          {canManageSettings && (
          <button
            type="button"
            className={`secondary-action compact-action service-order-settings-button icon-only ${settingsOpen ? "active" : ""}`}
            onClick={() => {
              setMonthPickerOpen(false);
              setFiltersOpen(false);
              setSettingsOpen((current) => !current);
            }}
            title="Configurações da Ordem de Serviço"
            aria-label="Configurações da Ordem de Serviço"
          >
            <Settings size={18} />
          </button>
          )}
          {canCreateOrders && (
          <button type="button" className="primary-action compact-action service-order-new-button icon-only" onClick={() => { setFiltersOpen(false); setFormOpen(true); }} title="Nova Ordem de Serviço" aria-label="Nova Ordem de Serviço">
            <Plus size={18} />
          </button>
          )}
          <button
            type="button"
            className={`secondary-action compact-action icon-only service-order-filter-toggle ${filtersOpen ? "active" : ""}`}
            onClick={() => {
              setMonthPickerOpen(false);
              setFiltersOpen((current) => !current);
            }}
            title="Filtros"
            aria-label="Filtros de Ordens de Serviço"
            aria-expanded={filtersOpen}
          >
            <ChevronDown size={18} />
          </button>
        </div>
        {filtersOpen && (
        <div className="service-order-filter-row service-order-filter-popover" aria-label="Filtros de Ordens de Serviço">
          {businessMode && canViewAllClients && (
            <label className="service-order-sector-filter">
              <span>Cliente</span>
              <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
                <option value="all">Todos os clientes</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.tradeName || client.legalName || "Cliente sem nome"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="service-order-sector-filter">
            <span>{businessMode ? "Setor/local" : "Setor"}</span>
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              {canViewAllSectors && <option value="all">Todos os setores</option>}
              <option value="mine">Meu setor</option>
              <option value={generalSector.id}>Geral</option>
              {availableSectors
                .filter((sector) => sector.id !== generalSector.id)
                .map((sector) => (
                  <option key={sector.id} value={sector.id}>{sector.name}</option>
                ))}
            </select>
          </label>
          <label className="service-order-sector-filter">
            <span>Prioridade</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">Todas</option>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="service-order-sector-filter">
            <span>Técnico</span>
            <select value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
              <option value="all">Todos</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.name}>{technician.name}</option>
              ))}
            </select>
          </label>
          <label className="service-order-sector-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos</option>
              {configuredStatuses.map((status) => (
                <option key={status.id} value={status.id}>{status.name}</option>
              ))}
            </select>
          </label>
        </div>
        )}
      </header>

      {settingsOpen && (
        <div className="modal-backdrop service-order-settings-backdrop" role="presentation">
          <section className="service-order-settings-modal" role="dialog" aria-modal="true" aria-label="Configurações da OS">
            <header className="service-order-settings-modal-header">
              <div>
                <span className="section-eyebrow">Ordens de Serviço</span>
                <h2>Configuração da OS</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} title="Fechar">
                <X size={18} />
              </button>
            </header>

            <div className="service-order-settings-tabs">
              {visibleSettingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={settingsTab === tab.id ? "active" : ""}
                  onClick={() => setSettingsTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="service-order-settings-content">
              {settingsTab === "general" && (
                <section className="service-order-settings-panel">
                  <header>
                    <div>
                      <strong>Geral</strong>
                      <span>Regras principais da Ordem de Serviço.</span>
                    </div>
                    <button type="button" className="primary-action compact-action" onClick={saveServiceOrderSettings} disabled={settingsSaving}>
                      {settingsSaving ? "Salvando..." : "Salvar"}
                    </button>
                  </header>
                  <div className="service-order-settings-accordion-list">
                    <SettingsAccordionSection
                      id="layout"
                      title="Visualização do painel"
                      description="Define como as ordens são exibidas no painel."
                      activeSection={generalSettingsSection}
                      onToggle={setGeneralSettingsSection}
                    >
                      <div className="service-order-number-settings service-order-general-settings">
                        <label>
                          Modo de exibição
                          <select
                            value={serviceOrderSettings.boardLayout}
                            onChange={(event) => updateServiceOrderSetting("boardLayout", event.target.value)}
                          >
                            <option value="horizontal">Lista horizontal</option>
                            <option value="vertical">Lista vertical</option>
                          </select>
                        </label>
                      </div>
                    </SettingsAccordionSection>

                    <SettingsAccordionSection
                      id="number"
                      title="Formato do número da OS"
                      description="Define a numeração das próximas ordens."
                      activeSection={generalSettingsSection}
                      onToggle={setGeneralSettingsSection}
                    >
                      <div className="service-order-number-settings">
                        <label>
                          Prefixo
                          <input
                            value={serviceOrderSettings.numberFormat.prefix}
                            onChange={(event) => updateServiceOrderSettingsField("numberFormat", "prefix", event.target.value)}
                            placeholder="OS"
                          />
                        </label>
                        <label>
                          Próximo número
                          <input
                            type="number"
                            min="1"
                            value={serviceOrderSettings.numberFormat.nextNumber || ""}
                            onChange={(event) => updateServiceOrderSettingsField("numberFormat", "nextNumber", event.target.value)}
                            placeholder="Automático"
                          />
                        </label>
                        <div className="service-order-number-preview">
                          <span>Prévia</span>
                          <strong>{buildServiceOrderNumberPreview(serviceOrderSettings)}</strong>
                        </div>
                        <label className="settings-inline-check">
                          <input
                            type="checkbox"
                            checked={Boolean(serviceOrderSettings.numberFormat.useYear)}
                            onChange={(event) => updateServiceOrderSettingsField("numberFormat", "useYear", event.target.checked)}
                          />
                          Usar ano no número
                        </label>
                        <label className="settings-inline-check">
                          <input
                            type="checkbox"
                            checked={Boolean(serviceOrderSettings.numberFormat.useMonth)}
                            onChange={(event) => updateServiceOrderSettingsField("numberFormat", "useMonth", event.target.checked)}
                          />
                          Usar mês no número
                        </label>
                      </div>
                    </SettingsAccordionSection>

                    <SettingsAccordionSection
                      id="priority"
                      title="Prioridade automática"
                      description="Controla escalonamento por tempo e cores das urgências."
                      activeSection={generalSettingsSection}
                      onToggle={setGeneralSettingsSection}
                    >
                      <div className="service-order-number-settings">
                        <label>
                          Baixa para Média (horas)
                          <input
                            type="number"
                            min="1"
                            value={serviceOrderSettings.autoPriority.lowToMediumHours}
                            onChange={(event) => updateServiceOrderSettingsField("autoPriority", "lowToMediumHours", event.target.value)}
                          />
                        </label>
                        <label>
                          Média para Alta (horas)
                          <input
                            type="number"
                            min="1"
                            value={serviceOrderSettings.autoPriority.mediumToHighHours}
                            onChange={(event) => updateServiceOrderSettingsField("autoPriority", "mediumToHighHours", event.target.value)}
                          />
                        </label>
                        <label>
                          Alta para Crítica (horas)
                          <input
                            type="number"
                            min="1"
                            value={serviceOrderSettings.autoPriority.highToCriticalHours}
                            onChange={(event) => updateServiceOrderSettingsField("autoPriority", "highToCriticalHours", event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="secondary-action compact-action service-order-priority-color-toggle"
                          onClick={() => setShowPriorityColorConfig((current) => !current)}
                        >
                          <Palette size={16} />
                          Configurar cores das prioridades
                        </button>
                        {showPriorityColorConfig && (
                          <div className="service-order-priority-colors service-order-priority-colors-expanded">
                            {Object.entries(priorityLabels).map(([priority, label]) => (
                              <label key={priority}>
                                <span className="service-order-color-swatch" style={{ background: priorityColors[priority] }} />
                                {label}
                                <input
                                  type="color"
                                  value={priorityColors[priority]}
                                  onChange={(event) => changePriorityColor(priority, event.target.value)}
                                  aria-label={`Cor da prioridade ${label}`}
                                />
                              </label>
                            ))}
                            <button type="button" className="ghost-action compact-action" onClick={resetPriorityColors}>
                              <RotateCcw size={15} />
                              Padrão
                            </button>
                          </div>
                        )}
                        <label className="settings-inline-check service-order-priority-enabled">
                          <input
                            type="checkbox"
                            checked={Boolean(serviceOrderSettings.autoPriority.enabled)}
                            onChange={(event) => updateServiceOrderSettingsField("autoPriority", "enabled", event.target.checked)}
                          />
                          Ativar prioridade automática
                        </label>
                      </div>
                    </SettingsAccordionSection>

                    <SettingsAccordionSection
                      id="statuses"
                      title="Segmentos/Status da OS"
                      description={`Configure até ${maxServiceOrderStatuses} status para o painel.`}
                      activeSection={generalSettingsSection}
                      onToggle={setGeneralSettingsSection}
                    >
                      <div className="service-order-status-header-actions service-order-status-header-inline">
                        <span>{configuredStatuses.length}/{maxServiceOrderStatuses} status</span>
                        <button
                          type="button"
                          className="secondary-action compact-action"
                          onClick={addStatus}
                          disabled={configuredStatuses.length >= maxServiceOrderStatuses}
                        >
                          <Plus size={16} />
                          Novo status
                        </button>
                      </div>
                      <div className="service-order-status-settings">
                        {configuredStatuses.map((status, index) => (
                          <article key={status.id} className="service-order-status-row" style={{ "--status-color": status.color }}>
                            <span className="service-order-status-dot" />
                            <input
                              value={status.name}
                              onChange={(event) => updateStatus(status.id, { name: event.target.value })}
                              aria-label="Nome do status"
                            />
                            <input
                              type="color"
                              value={status.color}
                              onChange={(event) => updateStatus(status.id, { color: event.target.value })}
                              aria-label={`Cor do status ${status.name}`}
                            />
                            <label>
                              <input
                                type="checkbox"
                                checked={status.isInitial}
                                onChange={(event) => event.target.checked && setStatusRole(status.id, "initial")}
                              />
                              Usar como abertura
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={status.isFinal}
                                onChange={(event) => event.target.checked && setStatusRole(status.id, "final")}
                              />
                              Usar como finalização
                            </label>
                            <div className="service-order-status-row-actions">
                              <button type="button" className="icon-button" onClick={() => moveStatus(status.id, -1)} disabled={index === 0} title="Subir">
                                <ArrowUp size={16} />
                              </button>
                              <button type="button" className="icon-button" onClick={() => moveStatus(status.id, 1)} disabled={index === configuredStatuses.length - 1} title="Descer">
                                <ArrowDown size={16} />
                              </button>
                              <button
                                type="button"
                                className="icon-button danger"
                                onClick={() => deleteStatus(status.id)}
                                disabled={configuredStatuses.length <= 2}
                                title="Excluir status"
                              >
                                <Trash2 size={16} />
                              </button>
                              {(status.isInitial || status.isFinal) && <CheckCircle2 size={18} className="service-order-status-special-icon" />}
                            </div>
                          </article>
                        ))}
                      </div>
                    </SettingsAccordionSection>
                  </div>
                </section>
              )}

              {settingsTab === "number" && (
                <section className="service-order-settings-panel">
                  <header>
                    <div>
                      <strong>Formato do numero da OS</strong>
                      <span>Aplicado somente as proximas ordens criadas.</span>
                    </div>
                    <button type="button" className="primary-action compact-action" onClick={saveServiceOrderSettings} disabled={settingsSaving}>
                      {settingsSaving ? "Salvando..." : "Salvar"}
                    </button>
                  </header>
                  <div className="service-order-number-settings">
                    <label>
                      Prefixo
                      <input
                        value={serviceOrderSettings.numberFormat.prefix}
                        onChange={(event) => updateServiceOrderSettingsField("numberFormat", "prefix", event.target.value)}
                        placeholder="OS"
                      />
                    </label>
                    <label>
                      Proximo numero
                      <input
                        type="number"
                        min="1"
                        value={serviceOrderSettings.numberFormat.nextNumber || ""}
                        onChange={(event) => updateServiceOrderSettingsField("numberFormat", "nextNumber", event.target.value)}
                        placeholder="Automático"
                      />
                    </label>
                    <div className="service-order-number-preview">
                      <span>Previa</span>
                      <strong>{buildServiceOrderNumberPreview(serviceOrderSettings)}</strong>
                    </div>
                    <label className="settings-inline-check">
                      <input
                        type="checkbox"
                        checked={Boolean(serviceOrderSettings.numberFormat.useYear)}
                        onChange={(event) => updateServiceOrderSettingsField("numberFormat", "useYear", event.target.checked)}
                      />
                      Usar ano no numero
                    </label>
                    <label className="settings-inline-check">
                      <input
                        type="checkbox"
                        checked={Boolean(serviceOrderSettings.numberFormat.useMonth)}
                        onChange={(event) => updateServiceOrderSettingsField("numberFormat", "useMonth", event.target.checked)}
                      />
                      Usar mês no número
                    </label>
                  </div>
                </section>
              )}

              {settingsTab === "priority" && (
                <section className="service-order-settings-panel">
                  <header>
                    <div>
                      <strong>Prioridade automática</strong>
                      <span>Define a subida de urgência pelo tempo em aberto.</span>
                    </div>
                    <button type="button" className="primary-action compact-action" onClick={saveServiceOrderSettings} disabled={settingsSaving}>
                      {settingsSaving ? "Salvando..." : "Salvar"}
                    </button>
                  </header>
                  <div className="service-order-number-settings">
                    <label>
                      Baixa para Média (horas)
                      <input
                        type="number"
                        min="1"
                        value={serviceOrderSettings.autoPriority.lowToMediumHours}
                        onChange={(event) => updateServiceOrderSettingsField("autoPriority", "lowToMediumHours", event.target.value)}
                      />
                    </label>
                    <label>
                      Média para Alta (horas)
                      <input
                        type="number"
                        min="1"
                        value={serviceOrderSettings.autoPriority.mediumToHighHours}
                        onChange={(event) => updateServiceOrderSettingsField("autoPriority", "mediumToHighHours", event.target.value)}
                      />
                    </label>
                    <label>
                      Alta para Crítica (horas)
                      <input
                        type="number"
                        min="1"
                        value={serviceOrderSettings.autoPriority.highToCriticalHours}
                        onChange={(event) => updateServiceOrderSettingsField("autoPriority", "highToCriticalHours", event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-action compact-action service-order-priority-color-toggle"
                      onClick={() => setShowPriorityColorConfig((current) => !current)}
                    >
                      <Palette size={16} />
                      Configurar cores das prioridades
                    </button>
                    {showPriorityColorConfig && (
                      <div className="service-order-priority-colors service-order-priority-colors-expanded">
                        {Object.entries(priorityLabels).map(([priority, label]) => (
                          <label key={priority}>
                            <span className="service-order-color-swatch" style={{ background: priorityColors[priority] }} />
                            {label}
                            <input
                              type="color"
                              value={priorityColors[priority]}
                              onChange={(event) => changePriorityColor(priority, event.target.value)}
                              aria-label={`Cor da prioridade ${label}`}
                            />
                          </label>
                        ))}
                        <button type="button" className="ghost-action compact-action" onClick={resetPriorityColors}>
                          <RotateCcw size={15} />
                          Padrão
                        </button>
                      </div>
                    )}
                    <label className="settings-inline-check service-order-priority-enabled">
                      <input
                        type="checkbox"
                        checked={Boolean(serviceOrderSettings.autoPriority.enabled)}
                        onChange={(event) => updateServiceOrderSettingsField("autoPriority", "enabled", event.target.checked)}
                      />
                      Ativar prioridade automática
                    </label>
                  </div>
                </section>
              )}

              {settingsTab === "statuses" && (
                <section className="service-order-settings-panel">
                  <header>
                    <div>
                      <strong>Segmentos/Status da OS</strong>
                      <span>Controle a ordem, cores e funções especiais do painel.</span>
                    </div>
                    <div className="service-order-status-header-actions">
                      <button type="button" className="secondary-action compact-action" onClick={addStatus}>
                        <Plus size={16} />
                        Novo status
                      </button>
                      <button type="button" className="primary-action compact-action" onClick={saveServiceOrderSettings} disabled={settingsSaving}>
                        {settingsSaving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </header>
                  <div className="service-order-status-settings">
                    {configuredStatuses.map((status, index) => (
                      <article key={status.id} className="service-order-status-row" style={{ "--status-color": status.color }}>
                        <span className="service-order-status-dot" />
                        <input
                          value={status.name}
                          onChange={(event) => updateStatus(status.id, { name: event.target.value })}
                          aria-label="Nome do status"
                        />
                        <input
                          type="color"
                          value={status.color}
                          onChange={(event) => updateStatus(status.id, { color: event.target.value })}
                          aria-label={`Cor do status ${status.name}`}
                        />
                        <label>
                          <input
                            type="checkbox"
                            checked={status.isInitial}
                            onChange={(event) => event.target.checked && setStatusRole(status.id, "initial")}
                          />
                          Usar como abertura
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={status.isFinal}
                            onChange={(event) => event.target.checked && setStatusRole(status.id, "final")}
                          />
                          Usar como finalização
                        </label>
                        <div className="service-order-status-row-actions">
                          <button type="button" className="icon-button" onClick={() => moveStatus(status.id, -1)} disabled={index === 0} title="Subir">
                            <ArrowUp size={16} />
                          </button>
                          <button type="button" className="icon-button" onClick={() => moveStatus(status.id, 1)} disabled={index === configuredStatuses.length - 1} title="Descer">
                            <ArrowDown size={16} />
                          </button>
                          {(status.isInitial || status.isFinal) && <CheckCircle2 size={18} className="service-order-status-special-icon" />}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {["clients", "technicians", "products", "services", "problemTypes"].includes(settingsTab) && (
                <SettingsView
                  token={token}
                  notify={notify}
                  systemMode={systemMode}
                  forcedSection={settingsTab}
                  hideHero
                  hideTabs
                />
              )}
            </div>
          </section>
        </div>
      )}

      <section className="service-orders-summary">
        <article>
          <ClipboardList size={18} />
          <span>Total</span>
          <strong>{visibleServiceOrders.length}</strong>
        </article>
        {configuredStatuses.map((status) => (
          <article key={status.id} style={{ "--service-order-status-color": status.color }}>
            <span>{status.name}</span>
            <strong>{visibleServiceOrders.filter((order) => order.status === status.id).length}</strong>
          </article>
        ))}
      </section>

      <section className={`service-order-kanban layout-${serviceOrderSettings.boardLayout}`} aria-label="Ordens por status">
        {configuredStatuses.map((status) => {
          const orders = visibleServiceOrders.filter((order) => order.status === status.id);

          return (
            <section
              key={status.id}
              className={`service-order-column ${dragOverStatus === status.id ? "is-drop-target" : ""}`}
              style={{ "--service-order-status-color": status.color }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStatus(status.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setDragOverStatus("");
                }
              }}
              onDrop={(event) => handleDrop(event, status.id)}
            >
              <header>
                <strong>{status.name}</strong>
                <span>{orders.length}</span>
              </header>
              <div className="service-order-column-list">
                {orders.length ? orders.map((order) => (
                  <ServiceOrderCard
                    key={order.id}
                    order={order}
                    asset={assetById.get(order.assetId)}
                    priorityColor={priorityColors[order.priority] || defaultPriorityColors[order.priority]}
                    businessMode={businessMode}
                    dragging={draggingOrderId === order.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onOpen={setSelectedOrder}
                  />
                )) : (
                  <p className="empty">Nenhuma OS neste status.</p>
                )}
              </div>
            </section>
          );
        })}
      </section>

      <ServiceOrderFormModal
        open={formOpen}
        devices={devices}
        tabs={tabs}
        activeTab={activeTab}
        token={token}
        notify={notify}
        systemMode={systemMode}
        serviceOrderSettings={serviceOrderSettings}
        sectors={availableSectors}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={async (payload) => {
          const created = await onCreate(payload);
          if (created) setFormOpen(false);
        }}
      />

      <ServiceOrderDetailsModal
        serviceOrder={selectedOrderCurrent}
        devices={devices}
        segments={segments}
        tabs={tabs}
        token={token}
        notify={notify}
        systemMode={systemMode}
        statuses={configuredStatuses}
        sectors={availableSectors}
        saving={saving}
        onClose={() => setSelectedOrder(null)}
        onUpdate={onUpdate}
        onAddHistory={onAddHistory}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onSelectBackup={onSelectBackup}
        onReleaseBackup={onReleaseBackup}
        permissions={permissions}
        canChangeSector={canChangeSector}
      />
    </section>
  );
}
