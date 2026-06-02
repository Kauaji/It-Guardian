import { useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, Clock3, Monitor, Plus, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
import { fetchDevice, fetchProducts, fetchServices, fetchTechnicians } from "../../api.js";
import { assetTypeLabel } from "../inventory/assetTypes.js";

const fallbackStatusLabels = {
  open: "Aberta",
  in_progress: "Em atendimento",
  waiting: "Aguardando",
  closed: "Finalizada"
};

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

const tabs = [
  { id: "general", label: "Geral" },
  { id: "attendance", label: "Atendimento" },
  { id: "asset", label: "Máquina" },
  { id: "history", label: "Histórico" }
];

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function DetailItem({ label, value }) {
  return (
    <div className="service-order-detail-item">
      <span>{label}</span>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function formatCurrency(value) {
  return moneyFormatter.format(Number(value || 0));
}

function parseCurrency(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).replace(/[^\d,.-]/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function normalizeQuantity(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 1;
}

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getProductPrice(product) {
  return parseCurrency(product?.unitPrice ?? product?.unit_price ?? product?.price ?? product?.salePrice ?? 0);
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const quantity = normalizeQuantity(item.quantity);
      const unitPrice = parseCurrency(item.unitPrice ?? item.unit_price);
      return {
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: item.productId || item.product_id || "",
        productName: item.productName || item.product_name || item.name || "",
        quantity,
        unitPrice,
        subtotal: Math.round(quantity * unitPrice * 100) / 100,
        notes: item.notes || ""
      };
    })
    .filter((item) => item.productName);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ServiceOrderDetailsModal({
  serviceOrder,
  devices = [],
  segments = [],
  tabs: inventoryTabs = [],
  token,
  notify,
  systemMode = "local",
  statuses = [],
  sectors = [],
  saving,
  onClose,
  onUpdate,
  onAddHistory,
  onStatusChange,
  onDelete,
  onSelectBackup,
  onReleaseBackup,
  permissions = {},
  canChangeSector = false
}) {
  const businessMode = systemMode === "business";
  const canEditOrder = permissions.edit ?? true;
  const canChangeStatus = permissions.changeStatus ?? true;
  const canFinishOrder = permissions.finish ?? canChangeStatus;
  const canRegisterAttendance = permissions.attendance ?? true;
  const canPrintOrder = permissions.print ?? true;
  const [activeTab, setActiveTab] = useState("general");
  const [technicians, setTechnicians] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [assetDetails, setAssetDetails] = useState(null);
  const [linkingAsset, setLinkingAsset] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ tabId: "", groupId: "", segmentId: "", search: "" });
  const [partDraft, setPartDraft] = useState({ productId: "", quantity: 1, unitPrice: "0" });
  const [partSearch, setPartSearch] = useState("");
  const [partSuggestionsOpen, setPartSuggestionsOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceSuggestionsOpen, setServiceSuggestionsOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    title: serviceOrder?.title || "",
    priority: serviceOrder?.priority || "medium",
    assignedTechnicianName: serviceOrder?.assignedTechnicianName || "",
    autoPriorityEnabled: serviceOrder?.autoPriorityEnabled ?? false,
    workNotes: serviceOrder?.workNotes || "",
    diagnosis: serviceOrder?.diagnosis || "",
    solution: serviceOrder?.solution || "",
    servicePerformed: serviceOrder?.servicePerformed || "",
    attendanceNotes: serviceOrder?.attendanceNotes || "",
    partsUsed: serviceOrder?.partsUsed || "",
    serviceValue: String(serviceOrder?.serviceValue ?? 0),
    items: normalizeItems(serviceOrder?.items || serviceOrder?.serviceItems || [])
  }));

  useEffect(() => {
    if (!serviceOrder) return;

    setActiveTab("general");
    setDraft({
      title: serviceOrder.title || "",
      priority: serviceOrder.priority || "medium",
      assignedTechnicianName: serviceOrder.assignedTechnicianName || "",
      autoPriorityEnabled: serviceOrder.autoPriorityEnabled ?? false,
      workNotes: serviceOrder.workNotes || "",
      diagnosis: serviceOrder.diagnosis || "",
      solution: serviceOrder.solution || "",
      servicePerformed: serviceOrder.servicePerformed || "",
      attendanceNotes: serviceOrder.attendanceNotes || "",
      partsUsed: serviceOrder.partsUsed || "",
      serviceValue: String(serviceOrder.serviceValue ?? 0),
      items: normalizeItems(serviceOrder.items || serviceOrder.serviceItems || [])
    });
    setPartDraft({ productId: "", quantity: 1, unitPrice: "0" });
    setPartSearch("");
    setPartSuggestionsOpen(false);
    setServiceSearch("");
    setSelectedServiceId("");
    setServiceSuggestionsOpen(false);
    setServicesOpen(false);
    setPartsOpen(false);
    setLinkingAsset(false);
  }, [serviceOrder?.id]);

  useEffect(() => {
    if (!serviceOrder || !token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    fetchProducts(token)
      .then((response) => setProducts((response.products || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    fetchServices(token)
      .then((response) => setServices((response.services || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));
  }, [serviceOrder?.id, token]);

  const asset = useMemo(
    () => assetDetails || devices.find((device) => device.id === serviceOrder?.assetId),
    [assetDetails, devices, serviceOrder?.assetId]
  );
  const backupAsset = useMemo(
    () => devices.find((device) => device.id === serviceOrder?.backupAssetId) || null,
    [devices, serviceOrder?.backupAssetId]
  );
  const availableBackupDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.isBackup &&
          device.backupStatus !== "in_use" &&
          device.id !== serviceOrder?.assetId &&
          device.id !== serviceOrder?.backupAssetId
      ),
    [devices, serviceOrder?.assetId, serviceOrder?.backupAssetId]
  );
  const serviceItems = useMemo(() => normalizeItems(draft.items), [draft.items]);
  const serviceValueNumber = useMemo(() => parseCurrency(draft.serviceValue), [draft.serviceValue]);
  const partsTotal = useMemo(
    () => serviceItems.reduce((total, item) => total + Number(item.subtotal || 0), 0),
    [serviceItems]
  );
  const totalValue = serviceValueNumber + partsTotal;
  const environmentLabel = businessMode ? "Cliente" : "Ambiente";
  const statusOptions = useMemo(
    () => statuses.length
      ? statuses
      : Object.entries(fallbackStatusLabels).map(([id, name]) => ({ id, name })),
    [statuses]
  );
  const statusLabelMap = useMemo(
    () => ({
      ...fallbackStatusLabels,
      ...Object.fromEntries(statusOptions.map((status) => [status.id, status.name]))
    }),
    [statusOptions]
  );
  const availableSectors = useMemo(
    () => {
      const byId = new Map([["sector-geral", { id: "sector-geral", name: "Geral", active: true }]]);
      for (const sector of sectors) {
        if (sector?.id && sector.active !== false) byId.set(sector.id, sector);
      }
      return [...byId.values()];
    },
    [sectors]
  );
  const filteredProductSuggestions = useMemo(() => {
    const term = normalizeSearchText(partSearch);
    const source = term
      ? products.filter((product) =>
          normalizeSearchText([product.name, product.category, product.brand, product.model, product.internalCode]
            .filter(Boolean)
            .join(" "))
            .includes(term)
        )
      : products;

    return source.slice(0, 7);
  }, [products, partSearch]);
  const filteredServiceSuggestions = useMemo(() => {
    const term = normalizeSearchText(serviceSearch);
    const source = term
      ? services.filter((service) =>
          normalizeSearchText([service.name, service.category]
            .filter(Boolean)
            .join(" "))
            .includes(term)
        )
      : services;

    return source.slice(0, 7);
  }, [services, serviceSearch]);
  const selectedPartProduct = useMemo(
    () =>
      products.find((product) => product.id === partDraft.productId) ||
      products.find((product) => normalizeSearchText(product.name) === normalizeSearchText(partSearch)) ||
      null,
    [products, partDraft.productId, partSearch]
  );

  useEffect(() => {
    let active = true;
    setAssetDetails(null);

    if (!serviceOrder?.assetId || !token) return undefined;

    fetchDevice(token, serviceOrder.assetId)
      .then((response) => {
        if (active) setAssetDetails(response.device);
      })
      .catch(() => {
        if (active) setAssetDetails(null);
      });

    return () => {
      active = false;
    };
  }, [serviceOrder?.assetId, token]);

  const visibleGroupsForLink = useMemo(() => {
    const groups = new Map();
    segments
      .filter((segment) => !segment.isDefault && (!linkDraft.tabId || segment.tabId === linkDraft.tabId))
      .forEach((segment) => {
        const groupId = segment.groupId || segment.group?.id || "ungrouped";
        const groupName = segment.groupName || segment.group?.name || "Sem grupo";
        groups.set(groupId, { id: groupId, name: groupName });
      });
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [segments, linkDraft.tabId]);
  const visibleSegmentsForLink = useMemo(
    () => segments.filter((segment) => {
      if (segment.isDefault) return false;
      if (linkDraft.tabId && segment.tabId !== linkDraft.tabId) return false;
      if (linkDraft.groupId) {
        const groupId = segment.groupId || segment.group?.id || "ungrouped";
        if (groupId !== linkDraft.groupId) return false;
      }
      return true;
    }),
    [segments, linkDraft.groupId, linkDraft.tabId]
  );
  const visibleDevicesForLink = useMemo(() => {
    const term = normalizeSearchText(linkDraft.search);
    return devices.filter((device) => {
      if (linkDraft.tabId && device.tabId !== linkDraft.tabId && !device.isGlobalUnorganized) return false;
      if (linkDraft.segmentId && device.segmentId !== linkDraft.segmentId) return false;
      if (linkDraft.groupId) {
        const deviceGroupId = device.groupId || device.segmentGroupId || device.group?.id || "";
        if (deviceGroupId && deviceGroupId !== linkDraft.groupId) return false;
      }
      if (!term) return true;
      return normalizeSearchText([device.name, device.ip, device.statusLabel, device.segmentName, device.groupName, device.segmentGroupName]
        .filter(Boolean)
        .join(" "))
        .includes(term);
    });
  }, [devices, linkDraft]);

  if (!serviceOrder) return null;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updatePartProduct(productId) {
    const product = products.find((item) => item.id === productId);
    setPartDraft((current) => ({
      ...current,
      productId,
      unitPrice: product ? String(getProductPrice(product)) : current.unitPrice
    }));
    setPartSearch(product?.name || "");
    setPartSuggestionsOpen(false);
  }

  function updateServicePerformed(service) {
    if (!service) {
      updateDraft("servicePerformed", "");
      setServiceSearch("");
      setSelectedServiceId("");
      return;
    }

    setServiceSearch(service.name);
    setSelectedServiceId(service.id);
    setServiceSuggestionsOpen(false);
    setDraft((current) => ({
      ...current,
      servicePerformed: service.name,
      serviceValue: businessMode
        ? (!parseCurrency(current.serviceValue) && service.defaultValue != null
          ? String(service.defaultValue)
          : current.serviceValue)
        : "0"
    }));
  }

  function confirmServicePerformed() {
    const typedService = serviceSearch.trim();
    const matchedService = services.find((service) => service.id === selectedServiceId)
      || services.find((service) => normalizeSearchText(service.name) === normalizeSearchText(typedService));
    if (matchedService) {
      updateServicePerformed(matchedService);
      return;
    }
    if (!typedService) return;
    setDraft((current) => ({ ...current, servicePerformed: typedService }));
    setServiceSuggestionsOpen(false);
  }

  function addPartToDraft() {
    const product = products.find((item) => item.id === partDraft.productId)
      || products.find((item) => normalizeSearchText(item.name) === normalizeSearchText(partSearch));
    const manualProductName = partSearch.trim();
    if (!product && !manualProductName) return;

    const quantity = normalizeQuantity(partDraft.quantity);
    const unitPrice = parseCurrency(partDraft.unitPrice);
    const subtotal = Math.round(quantity * unitPrice * 100) / 100;
    const productName = product?.name || manualProductName;
    const line = unitPrice
      ? `${productName} x${quantity} - ${formatCurrency(subtotal)}`
      : `${productName} x${quantity}`;

    setDraft((current) => ({
      ...current,
      partsUsed: [current.partsUsed, line].filter(Boolean).join("\n"),
      items: [
        ...normalizeItems(current.items),
        {
          id: `${product?.id || "manual"}-${Date.now()}`,
          productId: product?.id || "",
          productName,
          quantity,
          unitPrice,
          subtotal,
          notes: ""
        }
      ]
    }));
    setPartDraft({ productId: "", quantity: 1, unitPrice: "0" });
    setPartSearch("");
  }

  function removePartItem(itemId) {
    setDraft((current) => ({
      ...current,
      items: normalizeItems(current.items).filter((item) => item.id !== itemId)
    }));
  }

  function submitAttendance(event) {
    event.preventDefault();
    const payload = {
      ...draft,
      serviceValue: businessMode ? serviceValueNumber : 0,
      items: serviceItems,
      totalPartsValue: businessMode ? partsTotal : 0,
      totalValue: businessMode ? totalValue : 0
    };

    onUpdate(serviceOrder.id, payload);
  }

  function printServiceOrder() {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      notify?.("Não foi possível abrir a janela de impressão.", "danger");
      return;
    }

    const itemsRows = serviceItems.length
      ? serviceItems.map((item) => `
          <tr>
            <td>${escapeHtml(item.productName)}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${escapeHtml(formatCurrency(item.unitPrice))}</td>
            <td>${escapeHtml(formatCurrency(item.subtotal))}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">Sem peças/produtos com valor registrados.</td></tr>`;

    const financialSection = (businessMode || serviceValueNumber || partsTotal || serviceItems.length) ? `
      <section>
        <h2>Valores</h2>
        <div class="totals">
          <span>Valor do serviço <strong>${escapeHtml(formatCurrency(serviceValueNumber))}</strong></span>
          <span>Total de peças <strong>${escapeHtml(formatCurrency(partsTotal))}</strong></span>
          <span>Total geral <strong>${escapeHtml(formatCurrency(totalValue))}</strong></span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Peça/produto</th>
              <th>Qtd.</th>
              <th>Valor unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </section>
    ` : "";

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(serviceOrder.number)} - IT Guardian</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
            header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #dbe4ef; padding-bottom: 14px; margin-bottom: 18px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 22px 0 10px; font-size: 16px; }
            p { margin: 4px 0; color: #475569; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .card { border: 1px solid #dbe4ef; border-radius: 10px; padding: 10px; min-height: 62px; }
            .card span { display: block; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .card strong { display: block; margin-top: 6px; font-size: 14px; }
            .text { white-space: pre-wrap; border: 1px solid #dbe4ef; border-radius: 10px; padding: 12px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #dbe4ef; padding: 9px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; }
            .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
            .totals span { border: 1px solid #dbe4ef; border-radius: 10px; padding: 10px; color: #475569; }
            .totals strong { display: block; margin-top: 4px; color: #111827; font-size: 15px; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <p>IT Guardian - Ordem de Serviço</p>
              <h1>${escapeHtml(serviceOrder.number)} - ${escapeHtml(serviceOrder.title)}</h1>
              <p>${escapeHtml(statusLabelMap[serviceOrder.status] || serviceOrder.status)} - Prioridade ${escapeHtml(priorityLabels[serviceOrder.priority])}</p>
            </div>
            <div>
              <p>Aberta em</p>
              <strong>${escapeHtml(formatDate(serviceOrder.createdAt))}</strong>
            </div>
          </header>
          <section class="grid">
            <div class="card"><span>${escapeHtml(environmentLabel)}</span><strong>${escapeHtml(serviceOrder.environmentName || "Não informado")}</strong></div>
            <div class="card"><span>Setor</span><strong>${escapeHtml(serviceOrder.sectorName || "Geral")}</strong></div>
            <div class="card"><span>Solicitante</span><strong>${escapeHtml(serviceOrder.requesterName || "Não informado")}</strong></div>
            <div class="card"><span>Técnico</span><strong>${escapeHtml(serviceOrder.assignedTechnicianName || "Não informado")}</strong></div>
            <div class="card"><span>Categoria</span><strong>${escapeHtml(serviceOrder.category || "Não informado")}</strong></div>
            <div class="card"><span>Máquina/ativo</span><strong>${escapeHtml(asset?.name || serviceOrder.assetId || "Não informado")}</strong></div>
            <div class="card"><span>Finalizada em</span><strong>${escapeHtml(formatDate(serviceOrder.closedAt))}</strong></div>
          </section>
          <section>
            <h2>Solicitação</h2>
            <div class="text">${escapeHtml(serviceOrder.description || "Sem descrição informada.")}</div>
          </section>
          <section>
            <h2>Atendimento</h2>
            <div class="text">${escapeHtml([
              draft.servicePerformed || serviceOrder.servicePerformed ? `Serviço realizado: ${draft.servicePerformed || serviceOrder.servicePerformed}` : "",
              draft.diagnosis || serviceOrder.diagnosis ? `Diagnóstico: ${draft.diagnosis || serviceOrder.diagnosis}` : "",
              draft.attendanceNotes || serviceOrder.attendanceNotes ? `Observações: ${draft.attendanceNotes || serviceOrder.attendanceNotes}` : ""
            ].filter(Boolean).join("\n\n") || "Sem atendimento registrado.")}</div>
          </section>
          ${financialSection}
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 250);
  }

  async function linkAssetToOrder(device) {
    const tab = inventoryTabs.find((item) => item.id === device.tabId) || inventoryTabs.find((item) => item.id === linkDraft.tabId);
    await onUpdate(serviceOrder.id, {
      assetId: device.id,
      environmentId: tab?.id || serviceOrder.environmentId,
      environmentName: tab?.name || serviceOrder.environmentName
    });
    setLinkingAsset(false);
  }

  async function changeServiceOrderSector(sectorId) {
    const sector = availableSectors.find((item) => item.id === sectorId)
      || availableSectors.find((item) => item.id === "sector-geral");
    await onUpdate(serviceOrder.id, {
      sectorId: sector?.id || "sector-geral",
      sectorName: sector?.name || "Geral"
    });
  }

  async function deleteOrder() {
    const baseMessage = "Tem certeza que deseja excluir esta Ordem de Serviço? Essa ação não poderá ser desfeita.";
    const inProgressMessage = serviceOrder.closedAt
      ? ""
      : "\n\nEsta OS ainda não foi finalizada. Deseja excluir mesmo assim?";

    if (!window.confirm(`${baseMessage}${inProgressMessage}`)) return;

    const deleted = await onDelete?.(serviceOrder);
    if (deleted) onClose();
  }

  return (
    <div className="modal-backdrop asset-modal-backdrop" role="presentation">
      <section className="asset-modal service-order-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhes da OS">
        <header className="asset-modal-header">
          <div>
            <span className="asset-eyebrow">Ordem de Serviço</span>
            <h2>{serviceOrder.number} - {serviceOrder.title}</h2>
            <p>{statusLabelMap[serviceOrder.status] || serviceOrder.status} - Prioridade {priorityLabels[serviceOrder.priority]}</p>
          </div>
          <div className="asset-modal-header-actions">
            <select
              className="service-order-status-select"
              value={serviceOrder.status}
              disabled={!canChangeStatus}
              onChange={(event) => onStatusChange(serviceOrder, event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id} disabled={status.isFinal && !canFinishOrder}>
                  {status.name}
                </option>
              ))}
            </select>
            {canEditOrder && (
              <button
                type="button"
                className="icon-button danger service-order-delete-action"
                onClick={deleteOrder}
                disabled={saving}
                title="Excluir Ordem de Serviço"
              >
                <Trash2 size={18} />
              </button>
            )}
            {canPrintOrder && (
              <button type="button" className="icon-button" onClick={printServiceOrder} title="Imprimir OS A4">
                <Printer size={18} />
              </button>
            )}
            <button type="button" className="icon-button" onClick={onClose} title="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="machine-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="asset-modal-body">
          {activeTab === "general" && (
            <div className="service-order-general-stack">
              <section className="service-order-text-panel">
                <h3>Solicitação</h3>
                <p>{serviceOrder.description || "Sem descrição informada."}</p>
                {serviceOrder.notes && (
                  <>
                    <h3>Observações iniciais</h3>
                    <p>{serviceOrder.notes}</p>
                  </>
                )}
              </section>
              <section className="service-order-detail-grid">
                <DetailItem label="Número" value={serviceOrder.number} />
                <DetailItem label="Status" value={statusLabelMap[serviceOrder.status] || serviceOrder.status} />
                <DetailItem label="Prioridade" value={priorityLabels[serviceOrder.priority]} />
                {canChangeSector ? (
                  <label className="service-order-detail-item service-order-sector-edit">
                    <span>Setor responsável</span>
                    <select
                      value={serviceOrder.sectorId || "sector-geral"}
                      disabled={saving}
                      onChange={(event) => changeServiceOrderSector(event.target.value)}
                    >
                      {availableSectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>{sector.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <DetailItem label="Setor responsável" value={serviceOrder.sectorName || "Geral"} />
                )}
                <DetailItem label={environmentLabel} value={serviceOrder.environmentName} />
                <DetailItem label="Máquina/ativo" value={asset?.name || serviceOrder.assetId} />
                <DetailItem label="Máquina Backup" value={backupAsset?.name || serviceOrder.backupAssetId} />
                <DetailItem label="Solicitante" value={serviceOrder.requesterName} />
                <DetailItem label="Técnico" value={serviceOrder.assignedTechnicianName} />
                <DetailItem label="Categoria" value={serviceOrder.category} />
                <DetailItem
                  label="Serviço"
                  value={
                    serviceOrder.serviceCode && serviceOrder.serviceName
                      ? `${serviceOrder.serviceCode} - ${serviceOrder.serviceName}`
                      : serviceOrder.serviceName || serviceOrder.serviceCode || serviceOrder.servicePerformed
                  }
                />
                <DetailItem label="Aberta em" value={formatDate(serviceOrder.createdAt)} />
                <DetailItem label="Atualizada em" value={formatDate(serviceOrder.updatedAt)} />
                <DetailItem label="Finalizada em" value={formatDate(serviceOrder.closedAt)} />
                {businessMode && (
                  <>
                    <DetailItem label="Valor do serviço" value={serviceOrder.serviceValue ? formatCurrency(serviceOrder.serviceValue) : "Não informado"} />
                    <DetailItem label="Total de peças" value={formatCurrency(serviceOrder.totalPartsValue)} />
                    <DetailItem label="Total estimado" value={formatCurrency(serviceOrder.totalValue)} />
                  </>
                )}
              </section>
            </div>
          )}

          {activeTab === "attendance" && (
            <form
              className="service-order-attendance-form"
              onSubmit={submitAttendance}
            >
              <label className="service-order-title-field">
                Título
                <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
              </label>
              <label className="service-order-priority-field">
                Prioridade
                <select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)}>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="service-order-technician-field">
                Técnico responsável
                {technicians.length ? (
                  <select
                    value={draft.assignedTechnicianName}
                    onChange={(event) => updateDraft("assignedTechnicianName", event.target.value)}
                  >
                    <option value="">Selecione um técnico</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.name}>{technician.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="service-order-inline-empty">Não existem técnicos cadastrados. Cadastre técnicos nas Configurações da OS.</div>
                )}
              </label>
              <label className="service-order-auto-priority">
                <input
                  type="checkbox"
                  checked={Boolean(draft.autoPriorityEnabled)}
                  onChange={(event) => updateDraft("autoPriorityEnabled", event.target.checked)}
                />
                <span>{draft.autoPriorityEnabled ? "Automática" : "Manual"}</span>
              </label>
              <label className="service-order-wide-field">
                Diagnóstico
                <textarea value={draft.diagnosis} onChange={(event) => updateDraft("diagnosis", event.target.value)} />
              </label>
              <label className="service-order-wide-field">
                Observações do atendimento
                <textarea
                  value={draft.attendanceNotes}
                  onChange={(event) => updateDraft("attendanceNotes", event.target.value)}
                  placeholder="Registre detalhes adicionais do atendimento..."
                />
              </label>
              <section className={`service-order-collapsible-editor ${servicesOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="service-order-section-toggle"
                  onClick={() => setServicesOpen((current) => !current)}
                  aria-expanded={servicesOpen}
                >
                  <span>
                    <strong>Serviços realizados</strong>
                    <small>Classifique o procedimento feito pelo técnico.</small>
                  </span>
                  <ChevronDown size={18} />
                </button>
                {servicesOpen && (
                  <div className="service-order-section-body service-order-service-selector">
                    <label className="service-order-service-field">
                      Serviço
                      <div className="service-order-autocomplete">
                        <input
                          value={serviceSearch}
                          onChange={(event) => {
                            setServiceSearch(event.target.value);
                            setSelectedServiceId("");
                            updateDraft("servicePerformed", "");
                            setServiceSuggestionsOpen(true);
                          }}
                          onFocus={() => setServiceSuggestionsOpen(true)}
                          onBlur={() => window.setTimeout(() => setServiceSuggestionsOpen(false), 120)}
                          placeholder="Digite para buscar um serviço"
                          autoComplete="off"
                        />
                        {serviceSuggestionsOpen && (filteredServiceSuggestions.length > 0 || serviceSearch.trim()) && (
                          <div className="service-order-suggestions" role="listbox">
                            {filteredServiceSuggestions.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => updateServicePerformed(service)}
                              >
                                <strong>{service.name}</strong>
                                {service.category && <span>{service.category}</span>}
                              </button>
                            ))}
                            {!filteredServiceSuggestions.length && serviceSearch.trim() && (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={confirmServicePerformed}
                              >
                                <strong>Usar "{serviceSearch.trim()}"</strong>
                                <span>Registrar serviço digitado manualmente</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                    <button
                      type="button"
                      className="primary-action compact-action service-order-add-icon"
                      onClick={confirmServicePerformed}
                      disabled={!selectedServiceId && !serviceSearch.trim()}
                      title="Adicionar serviço"
                      aria-label="Adicionar serviço"
                    >
                      <Plus size={18} />
                    </button>
                    {businessMode && (
                      <label className="service-order-service-value-field">
                      Valor do serviço
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.serviceValue}
                        onChange={(event) => updateDraft("serviceValue", event.target.value)}
                        onBlur={() => updateDraft("serviceValue", String(serviceValueNumber))}
                        placeholder="R$ 0,00"
                      />
                      </label>
                    )}
                    {!services.length && <p className="empty">Nenhum serviço cadastrado. Cadastre serviços nas Configurações da OS.</p>}
                  </div>
                )}
              </section>
              <section className={`service-order-collapsible-editor ${partsOpen ? "open" : ""}`}>
                <button
                  type="button"
                  className="service-order-section-toggle"
                  onClick={() => setPartsOpen((current) => !current)}
                  aria-expanded={partsOpen}
                >
                  <span>
                    <strong>Peças trocadas</strong>
                    <small>Registre produtos ou peças usadas no atendimento.</small>
                  </span>
                  <ChevronDown size={18} />
                </button>
                {partsOpen && (
                  <div className="service-order-section-body">
                    <div className={`service-order-parts-grid ${businessMode ? "business" : ""}`}>
                      <label className="service-order-part-product-field">
                        Produto/peça
                        <div className="service-order-autocomplete">
                          <input
                            value={partSearch}
                            onChange={(event) => {
                              setPartSearch(event.target.value);
                              setPartSuggestionsOpen(true);
                              setPartDraft((current) => ({ ...current, productId: "" }));
                            }}
                            onFocus={() => setPartSuggestionsOpen(true)}
                            onBlur={() => window.setTimeout(() => setPartSuggestionsOpen(false), 120)}
                            placeholder="Digite para buscar uma peça"
                            autoComplete="off"
                          />
                          {partSuggestionsOpen && (filteredProductSuggestions.length > 0 || partSearch.trim()) && (
                            <div className="service-order-suggestions" role="listbox">
                              {filteredProductSuggestions.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => updatePartProduct(product.id)}
                                >
                                  <strong>{product.name}</strong>
                                  {[product.category, product.brand, product.model].filter(Boolean).join(" - ") && (
                                    <span>{[product.category, product.brand, product.model].filter(Boolean).join(" - ")}</span>
                                  )}
                                </button>
                              ))}
                              {!filteredProductSuggestions.length && partSearch.trim() && (
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={addPartToDraft}
                                >
                                  <strong>Usar "{partSearch.trim()}"</strong>
                                  <span>Registrar peça digitada manualmente</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                      <label className="service-order-part-category-field">
                        Categoria
                        <input value={selectedPartProduct?.category || "Não informado"} readOnly />
                      </label>
                      <label className="service-order-part-brand-field">
                        Marca
                        <input value={selectedPartProduct?.brand || "Não informado"} readOnly />
                      </label>
                      <label className="service-order-part-quantity-field">
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          value={partDraft.quantity}
                          onChange={(event) => setPartDraft((current) => ({ ...current, quantity: event.target.value }))}
                        />
                      </label>
                      {businessMode && (
                        <label className="service-order-part-price-field">
                          Valor unitário
                          <input
                            type="text"
                            inputMode="decimal"
                            value={partDraft.unitPrice}
                            onChange={(event) => setPartDraft((current) => ({ ...current, unitPrice: event.target.value }))}
                            placeholder="R$ 0,00"
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        className="primary-action compact-action service-order-add-icon"
                        onClick={addPartToDraft}
                        disabled={!partDraft.productId && !partSearch.trim()}
                        title="Adicionar peça"
                        aria-label="Adicionar peça"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    {!products.length && <p className="empty">Nenhuma peça cadastrada. Cadastre peças nas Configurações da OS.</p>}
                  </div>
                )}
              </section>
              {businessMode && Boolean(serviceItems.length || serviceValueNumber || partsTotal) && (
                <div className="service-order-financial-panel service-order-financial-panel-standalone">
                  {serviceItems.length ? (
                    <div className="service-order-items-list">
                      {serviceItems.map((item) => (
                        <article key={item.id}>
                          <div>
                            <strong>{item.productName}</strong>
                            <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                          </div>
                          <strong>{formatCurrency(item.subtotal)}</strong>
                          <button type="button" className="icon-button danger" onClick={() => removePartItem(item.id)} title="Remover peca">
                            <X size={15} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty">Nenhuma peça com valor adicionada.</p>
                  )}
                  <div className="service-order-totals">
                    <span>Total de peças <strong>{formatCurrency(partsTotal)}</strong></span>
                    <span>Serviço <strong>{formatCurrency(serviceValueNumber)}</strong></span>
                    <span className="grand-total">Total estimado <strong>{formatCurrency(totalValue)}</strong></span>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button className="primary-action compact-action" disabled={saving || !canRegisterAttendance}>
                  {saving ? "Salvando..." : "Salvar atendimento"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "asset" && (
            <section className="service-order-asset-panel">
              {asset ? (
                <>
                  <div>
                    <Monitor size={18} />
                    <strong>{asset.name}</strong>
                    <span>{asset.ip} - {assetTypeLabel(asset.assetType)} - {asset.statusLabel}</span>
                  </div>
                  <div className="service-order-detail-grid">
                    <DetailItem label="Nome fantasia" value={asset.alias || asset.displayName || asset.name} />
                    <DetailItem label="IP" value={asset.ip} />
                    <DetailItem label="Status" value={asset.statusLabel} />
                    <DetailItem label="Tipo" value={assetTypeLabel(asset.assetType)} />
                    <DetailItem label={environmentLabel} value={serviceOrder.environmentName} />
                    <DetailItem label="Segmento" value={asset.segmentName} />
                    <DetailItem label="Sistema operacional" value={asset.hardware?.os} />
                    <DetailItem label="Fabricante" value={asset.hardware?.manufacturer} />
                    <DetailItem label="Modelo" value={asset.hardware?.model} />
                    <DetailItem label="Serial" value={asset.hardware?.serialNumber} />
                    <DetailItem label="Patrimônio" value={asset.hardware?.assetTag || asset.manualAsset?.assetTag} />
                    <DetailItem label="CPU" value={asset.metrics?.cpu != null ? `${asset.metrics.cpu}%` : "Não disponível"} />
                    <DetailItem label="RAM" value={asset.metrics?.ram != null ? `${asset.metrics.ram}%` : "Não disponível"} />
                    <DetailItem label="Disco" value={asset.metrics?.disk != null ? `${asset.metrics.disk}%` : "Não disponível"} />
                    <DetailItem label="Saúde do disco" value={asset.hardware?.diskHealth || asset.hardware?.smartStatus || "Não disponível"} />
                    <DetailItem label="Último inventário" value={formatDate(asset.hardware?.lastInventoryAt)} />
                    <DetailItem label="Último ping" value={formatDate(asset.lastPingAt)} />
                  </div>
                </>
              ) : (
                <div className="service-order-link-empty">
                  <p className="empty">Nenhuma máquina ou ativo vinculado a esta OS.</p>
                  <button type="button" className="secondary-action compact-action" onClick={() => setLinkingAsset((current) => !current)}>
                    <Plus size={16} />
                    Vincular máquina
                  </button>
                </div>
              )}

              <section className="service-order-backup-panel">
                <header>
                  <Archive size={18} />
                  <div>
                    <strong>Máquina Backup</strong>
                    <span>Reserva temporária para substituir a máquina principal durante a manutenção.</span>
                  </div>
                </header>
                {!asset ? (
                  <p className="empty">Vincule a máquina principal antes de selecionar um Backup.</p>
                ) : backupAsset ? (
                  <article className="service-order-linked-backup">
                    <div>
                      <strong>{backupAsset.name}</strong>
                      <span>{backupAsset.ip || "Sem IP"} - {assetTypeLabel(backupAsset.assetType)} - {backupAsset.statusLabel || "Sem status"}</span>
                    </div>
                    <button
                      type="button"
                      className="ghost-action compact-action"
                      disabled={saving}
                      onClick={() => onReleaseBackup?.(serviceOrder)}
                    >
                      <RotateCcw size={15} />
                      Devolver Backup
                    </button>
                  </article>
                ) : (
                  <>
                    {availableBackupDevices.length ? (
                      <div className="service-order-backup-card-list">
                        {availableBackupDevices.map((device) => (
                          <button
                            key={device.id}
                            type="button"
                            disabled={saving}
                            onClick={() => onSelectBackup?.(serviceOrder, device)}
                          >
                            <strong>{device.name}</strong>
                            <span>{device.ip || "Sem IP"} - {assetTypeLabel(device.assetType)} - {device.statusLabel || "Sem status"}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="empty">Nenhuma máquina Backup disponível no momento.</p>
                    )}
                  </>
                )}
              </section>

              {linkingAsset && (
                <section className="service-order-link-wizard">
                  <label>
                    1. Aba/Ambiente
                    <select
                      value={linkDraft.tabId}
                      onChange={(event) => setLinkDraft({ tabId: event.target.value, groupId: "", segmentId: "", search: "" })}
                    >
                      <option value="">Selecione</option>
                      {inventoryTabs.map((tab) => (
                        <option key={tab.id} value={tab.id}>{tab.name || "Novo ambiente"}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    2. Grupo
                    <select
                      value={linkDraft.groupId}
                      disabled={!linkDraft.tabId}
                      onChange={(event) => setLinkDraft((current) => ({ ...current, groupId: event.target.value, segmentId: "", search: "" }))}
                    >
                      <option value="">Todos os grupos</option>
                      {visibleGroupsForLink.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    3. Segmento
                    <select
                      value={linkDraft.segmentId}
                      disabled={!linkDraft.tabId}
                      onChange={(event) => setLinkDraft((current) => ({ ...current, segmentId: event.target.value }))}
                    >
                      <option value="">Selecione</option>
                      {visibleSegmentsForLink.map((segment) => (
                        <option key={segment.id} value={segment.id}>{segment.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="service-order-link-search">
                    <Search size={16} />
                    <input
                      value={linkDraft.search}
                      disabled={!linkDraft.segmentId}
                      onChange={(event) => setLinkDraft((current) => ({ ...current, search: event.target.value }))}
                      placeholder="Buscar máquina no segmento"
                    />
                  </label>
                  <div className="service-order-link-cards">
                    {linkDraft.segmentId && visibleDevicesForLink.length ? visibleDevicesForLink.map((device) => (
                      <button key={device.id} type="button" onClick={() => linkAssetToOrder(device)}>
                        <strong>{device.name}</strong>
                        <span>{device.ip || "Sem IP"} - {device.statusLabel || "Sem status"}</span>
                      </button>
                    )) : (
                      <p className="empty">Escolha uma aba, grupo e segmento para listar máquinas.</p>
                    )}
                  </div>
                </section>
              )}
            </section>
          )}

          {activeTab === "history" && (
            <section className="service-order-history-panel">
              {!asset && <p className="empty">Vincule uma máquina para visualizar o histórico técnico do ativo.</p>}
              <div className="service-order-history-list">
                {(serviceOrder.history || []).length ? serviceOrder.history.map((event) => (
                  <article key={event.id}>
                    <Clock3 size={15} />
                    <div>
                      <strong>{event.message}</strong>
                      <span>{formatDate(event.createdAt)} - {event.userName || "Sistema"}</span>
                      {(event.oldValue || event.newValue) && (
                        <small>{event.oldValue || "-"} {"->"} {event.newValue || "-"}</small>
                      )}
                    </div>
                  </article>
                )) : (
                  <p className="empty">Sem histórico de OS registrado.</p>
                )}
                {(asset?.assetHistory || []).map((event) => (
                  <article key={`asset-${event.id}`}>
                    <Clock3 size={15} />
                    <div>
                      <strong>{event.message}</strong>
                      <span>{formatDate(event.createdAt)} - {event.userName || "Sistema"}</span>
                      {(event.oldValue || event.newValue) && (
                        <small>{event.oldValue || "-"} {"->"} {event.newValue || "-"}</small>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        {Boolean(businessMode || serviceValueNumber || partsTotal || serviceItems.length) && (
          <section className="service-order-print-financial" aria-hidden="true">
            <h3>Valores da Ordem de Serviço</h3>
            <div className="service-order-print-financial-grid">
              <span>Valor do serviço</span>
              <strong>{formatCurrency(serviceValueNumber)}</strong>
              <span>Total de peças</span>
              <strong>{formatCurrency(partsTotal)}</strong>
              <span>Total geral</span>
              <strong>{formatCurrency(totalValue)}</strong>
            </div>
            {serviceItems.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Peça/produto</th>
                    <th>Qtd.</th>
                    <th>Valor unit.</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.map((item) => (
                    <tr key={`print-${item.id}`}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Sem peças/produtos com valor registrados.</p>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
