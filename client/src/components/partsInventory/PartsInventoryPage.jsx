import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Boxes, CheckCircle2, ChevronDown, ChevronRight, CircuitBoard, Cpu, ExternalLink, FileUp, FolderTree, HardDrive, History, Keyboard, Layers3, MemoryStick, Monitor, MousePointer2, PackagePlus, Search, Settings2, ShieldAlert, Trash2, TriangleAlert, Warehouse, X, Zap } from "lucide-react";
import { createPartCategory, createPartInventoryItem, createPartInventoryMovement, deletePartCategory, fetchPartCategories, fetchPartInventoryItem, fetchPartsInventory, importPartsInvoice, reviewPartInventoryDiscrepancy, syncPartsFromAssets, updatePartInventoryItem } from "../../api.js";
import { formatSegmentName } from "../../utils/display.js";
import { buildComputerKits, buildKitHierarchy, groupPartsByFamily, resolvePartFamily, summarizeKitFamily } from "./partFamilies.js";
import "./partsInventory.css";

const EMPTY_PART = { name: "", category: "", brand: "", model: "", internalCode: "", manufacturerPartNumber: "", serialNumber: "", macAddress: "", location: "", quantity: 0, minimumStock: 0, unitPrice: 0, unit: "un", conditionStatus: "new", notes: "", active: true };
const MOVEMENT_LABELS = { receipt: "Entrada", consumption: "Consumo", return: "Retorno", adjustment: "Ajuste de saldo", assignment: "Designação", unassignment: "Desvinculação" };
const INVENTORY_LABELS = { available: "Disponível", in_use: "Em uso" };
const FAMILY_ICONS = { motherboard: CircuitBoard, processor: Cpu, graphics: Monitor, memory: MemoryStick, storage: HardDrive, power: Zap, mouse: MousePointer2, keyboard: Keyboard, monitor: Monitor, misc: Boxes };
const CORE_HARDWARE_TYPES = new Set(["cpu", "motherboard", "memory", "disk", "graphics", "power_supply"]);

function isHardwareDiscrepancy(part) {
  return part.discrepancyStatus !== "ok" && CORE_HARDWARE_TYPES.has(part.metadata?.hardwareType);
}

function readableSnapshot(snapshot) {
  if (!snapshot) return "Não informado";
  if (typeof snapshot === "string") {
    try { return readableSnapshot(JSON.parse(snapshot)); } catch { return snapshot; }
  }
  if (Array.isArray(snapshot)) return snapshot.filter(Boolean).join(" · ") || "Não informado";
  return [snapshot.name, snapshot.brand, snapshot.model, snapshot.manufacturerPartNumber, snapshot.serialNumber, snapshot.capacityGb ? `${snapshot.capacityGb} GB` : null].filter(Boolean).join(" · ") || "Não informado";
}

function PartCard({ part, onOpen }) {
  const family = resolvePartFamily(part);
  const Icon = FAMILY_ICONS[family.id] || Boxes;
  const discrepancy = isHardwareDiscrepancy(part);
  return <button type="button" className={`part-card stock-${part.stockStatus} state-${part.inventoryState} ${discrepancy ? "has-discrepancy" : ""}`} style={{ "--family-color": family.color }} onClick={() => onOpen(part)}><span className="part-card-icon"><Icon /></span><div><span className="part-card-kicker"><small>{part.category || "Diversos"}</small><b>{INVENTORY_LABELS[part.inventoryState] || "Disponível"}</b></span><strong>{part.name}</strong><em>{[part.brand, part.model].filter(Boolean).join(" · ") || part.internalCode || "Cadastro técnico"}</em>{discrepancy ? <span className="part-card-warning"><ShieldAlert size={13} /> Conferência necessária</span> : null}</div><span className="part-stock"><strong>{part.quantity}</strong>{part.unit}<small>{part.inventoryState === "in_use" ? (discrepancy ? "Revisar" : "Ver kit") : part.stockStatus === "out" ? "Sem estoque" : part.stockStatus === "low" ? "Reposição necessária" : "Disponível"}</small></span></button>;
}

function ComputerKitCard({ kit, expanded, focused, cardRef, onToggle, onOpenAsset }) {
  return <article ref={cardRef} tabIndex={focused ? -1 : undefined} className={`computer-kit-card ${expanded ? "is-expanded" : ""} ${focused ? "is-focused" : ""}`}>
    <button type="button" className="computer-kit-trigger" onClick={onToggle} aria-expanded={expanded}>
      <span><Cpu size={18} /></span><strong>{kit.name}</strong><ChevronRight size={18} />
    </button>
    {expanded ? <div className="computer-kit-details">
      <header><span>{formatSegmentName(kit.segmentName)} · {kit.parts.length} componente(s) físico(s)</span><button type="button" className="secondary-action" onClick={() => onOpenAsset?.(kit.assetId)}><ExternalLink size={15} /> Abrir ativo</button></header>
      {groupPartsByFamily(kit.parts).map((family) => <section key={family.id} style={{ "--family-color": family.color }}><span>{family.label}</span><strong>{summarizeKitFamily(family)}</strong></section>)}
    </div> : null}
  </article>;
}

function ComputerKitsView({ kits, tabs, groups, segments, activeTabId, onSelectTab, expandedKitId, focusedKitAssetId, focusedKitRef, onToggleKit, onOpenAsset }) {
  const hierarchy = buildKitHierarchy(kits, { tabs, groups, segments, activeTabId });
  const renderKit = (kit) => <ComputerKitCard key={kit.assetId} kit={kit} expanded={expandedKitId === kit.assetId} focused={focusedKitAssetId === kit.assetId} cardRef={focusedKitAssetId === kit.assetId ? focusedKitRef : null} onToggle={() => onToggleKit(kit.assetId)} onOpenAsset={onOpenAsset} />;
  const renderSegment = (segment) => <section className="computer-kits-segment" style={{ "--segment-color": segment.color || "#2563eb" }} key={segment.id}><header><span /><div><strong>{formatSegmentName(segment.name)}</strong><small>{segment.kits.length} {segment.kits.length === 1 ? "máquina" : "máquinas"}</small></div></header><div className="computer-kits-grid">{segment.kits.map(renderKit)}</div></section>;

  return <div className="computer-kits-hierarchy">
    {tabs.length ? <nav className="computer-kits-tabs" aria-label="Ambientes dos kits">{tabs.map((tab) => <button type="button" key={tab.id} className={tab.id === activeTabId ? "active" : ""} style={{ "--tab-color": tab.color || "#2563eb" }} onClick={() => onSelectTab(tab.id)}><span />{tab.name || "Novo ambiente"}</button>)}</nav> : null}
    {hierarchy.groups.map((group) => <section className="computer-kits-group" style={{ "--group-color": group.color || "#64748b" }} key={group.id}><header><FolderTree size={17} /><strong>{group.name}</strong><small>{group.segments.reduce((total, segment) => total + segment.kits.length, 0)} máquina(s)</small></header>{group.segments.map(renderSegment)}</section>)}
    {hierarchy.standaloneSegments.map(renderSegment)}
    {!hierarchy.groups.length && !hierarchy.standaloneSegments.length ? <div className="parts-empty"><Layers3 size={34} /><strong>Nenhum kit neste ambiente</strong><span>Os kits acompanham a mesma organização do Inventário de Ativos.</span></div> : null}
  </div>;
}

function PartForm({ part, categories, saving, onClose, onSave }) {
  const [form, setForm] = useState(part ? { ...EMPTY_PART, ...part } : EMPTY_PART);
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.type === "number" ? Number(event.target.value) : event.target.value }));
  return <div className="parts-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="parts-form-modal" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
      <header><div><span>Cadastro rastreável</span><h2>{part ? "Editar peça" : "Nova peça"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button></header>
      <div className="parts-form-grid">
        <label className="wide">Nome<input value={form.name} onChange={set("name")} required /></label>
        <label>Categoria<select value={form.category || ""} onChange={set("category")} required><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
        <label>Fabricante<input value={form.brand || ""} onChange={set("brand")} /></label><label>Modelo<input value={form.model || ""} onChange={set("model")} /></label>
        <label>Código interno<input value={form.internalCode || ""} onChange={set("internalCode")} /></label><label>Part number<input value={form.manufacturerPartNumber || ""} onChange={set("manufacturerPartNumber")} /></label>
        <label>Número de série<input value={form.serialNumber || ""} onChange={set("serialNumber")} /></label><label>MAC<input value={form.macAddress || ""} onChange={set("macAddress")} /></label>
        <label>Localização<input value={form.location || ""} onChange={set("location")} placeholder="Almoxarifado / prateleira" /></label><label>Condição<select value={form.conditionStatus} onChange={set("conditionStatus")}><option value="new">Nova</option><option value="used">Usada</option><option value="refurbished">Recondicionada</option><option value="damaged">Danificada</option></select></label>
        {!part ? <label>Estoque inicial<input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} /></label> : null}<label>Estoque mínimo<input type="number" min="0" step="1" value={form.minimumStock} onChange={set("minimumStock")} /></label>
        <label>Valor unitário<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={set("unitPrice")} /></label><label>Unidade<input value={form.unit || "un"} onChange={set("unit")} /></label>
        <label className="wide">Observações<textarea rows="3" value={form.notes || ""} onChange={set("notes")} /></label>
      </div>
      <footer><button type="button" className="secondary-action" onClick={onClose}>Cancelar</button><button type="submit" className="primary-action" disabled={saving}>{saving ? "Salvando..." : "Salvar peça"}</button></footer>
    </form>
  </div>;
}

function CategoryModal({ categories, saving, onClose, onCreate, onDelete }) {
  const [name, setName] = useState("");
  return <div className="parts-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="parts-form-modal parts-category-modal" role="dialog" aria-modal="true" aria-labelledby="parts-category-title">
      <header><div><span>Configuração do inventário</span><h2 id="parts-category-title">Categorias de peças</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button></header>
      <form className="parts-category-create" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim()).then(() => setName("")); }}><label>Nova categoria<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Refrigeração" /></label><button className="primary-action" disabled={saving || !name.trim()}>Adicionar</button></form>
      <div className="parts-category-list">{categories.map((category) => <div key={category.id}><span style={{ "--category-color": category.color }} /><strong>{category.name}</strong><button type="button" className="icon-button danger" onClick={() => onDelete(category.id)} aria-label={`Remover ${category.name}`}><Trash2 size={15} /></button></div>)}</div>
    </section>
  </div>;
}

function PartInspector({ part, devices, serviceOrders, permissions, saving, onClose, onEdit, onMove, onOpenAsset, onReviewDiscrepancy }) {
  const [movement, setMovement] = useState({ movementType: "consumption", quantity: 1, assetId: "", serviceOrderId: "", notes: "" });
  const assetName = (id) => devices.find((item) => item.id === id)?.alias || devices.find((item) => item.id === id)?.hostname || id;
  return <aside className="part-inspector">
    <header><div><span>{part.category || "Peça"}</span><h3>{part.name}</h3></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X /></button></header>
    <div className="part-inspector-body">
      {isHardwareDiscrepancy(part) ? <div className="part-discrepancy"><ShieldAlert /><div><strong>{part.discrepancyStatus === "missing" ? "Componente não localizado" : "Alteração física detectada"}</strong><span>{part.discrepancyDetails?.reason || "O agente identificou uma mudança de hardware sem movimentação ou OS correspondente."}</span><dl className="part-discrepancy-comparison"><div><dt>Antes</dt><dd>{readableSnapshot(part.discrepancyDetails?.previous)}</dd></div><div><dt>Coleta atual</dt><dd>{part.discrepancyStatus === "missing" ? "Não localizado nesta máquina" : readableSnapshot(part.discrepancyDetails?.current)}</dd></div></dl>{part.assignedAssetId || part.sourceAssetId ? <button type="button" onClick={() => onOpenAsset?.(part.assignedAssetId || part.sourceAssetId)}><ExternalLink size={14} /> Localizar máquina no Inventário de Ativos</button> : null}{permissions.reconcileHardware ? <div className="part-discrepancy-actions"><button type="button" className="secondary-action" disabled={saving} onClick={() => onReviewDiscrepancy("keep")}>Manter pendente</button><button type="button" className="secondary-action danger" disabled={saving} onClick={() => onReviewDiscrepancy("dismiss")}>Descartar incongruência</button></div> : null}</div></div> : null}
      <dl className="part-identity"><div><dt>Situação</dt><dd>{INVENTORY_LABELS[part.inventoryState] || part.inventoryState}</dd></div><div><dt>Quantidade</dt><dd>{part.quantity} {part.unit}</dd></div><div><dt>ID da peça</dt><dd>{part.internalCode || part.id}</dd></div><div><dt>Série / MAC</dt><dd>{part.serialNumber || part.macAddress || "—"}</dd></div><div><dt>Localização</dt><dd>{part.location || "Não informada"}</dd></div><div><dt>Ativo atual</dt><dd>{part.assignedAssetId ? assetName(part.assignedAssetId) : "Não vinculado"}</dd></div>{part.supplierName ? <div className="wide"><dt>Fornecedor</dt><dd>{part.supplierName}</dd></div> : null}</dl>
      {permissions.update && part.source !== "agent" ? <button type="button" className="secondary-action" onClick={onEdit}>Editar cadastro</button> : null}
      {permissions.moveStock && part.inventoryState === "available" ? <form className="part-movement-form" onSubmit={(event) => { event.preventDefault(); onMove(movement); }}><h4><ArrowDownToLine size={16} /> Movimentar estoque</h4><div><label>Operação<select value={movement.movementType} onChange={(event) => setMovement((current) => ({ ...current, movementType: event.target.value }))}>{Object.entries(MOVEMENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Quantidade<input type="number" min="1" step="1" value={movement.quantity} onChange={(event) => setMovement((current) => ({ ...current, quantity: Number(event.target.value) }))} /></label></div><label>Ativo<select value={movement.assetId} onChange={(event) => setMovement((current) => ({ ...current, assetId: event.target.value }))}><option value="">Sem ativo</option>{devices.map((item) => <option key={item.id} value={item.id}>{assetName(item.id)}</option>)}</select></label><label>Ordem de Serviço<select value={movement.serviceOrderId} onChange={(event) => setMovement((current) => ({ ...current, serviceOrderId: event.target.value }))}><option value="">Sem OS</option>{serviceOrders.filter((item) => !item.closedAt && item.status !== "closed").map((item) => <option key={item.id} value={item.id}>{item.number} · {item.title}</option>)}</select></label><label>Observação<input value={movement.notes} onChange={(event) => setMovement((current) => ({ ...current, notes: event.target.value }))} placeholder="Motivo, lote ou destino" /></label><button type="submit" className="primary-action" disabled={saving}>{saving ? "Registrando..." : "Registrar movimentação"}</button></form> : null}
      <section className="part-history"><h4><History size={16} /> Histórico da peça</h4>{part.movements?.length ? <ol>{part.movements.map((item) => <li key={item.id}><span className={`movement-icon type-${item.movementType}`}>{["receipt", "return"].includes(item.movementType) ? "+" : "−"}</span><div><strong>{MOVEMENT_LABELS[item.movementType] || item.movementType} · {item.quantity} {part.unit}</strong><small>{new Date(item.createdAt).toLocaleString("pt-BR")} · saldo {item.previousQuantity} → {item.resultingQuantity}</small>{item.serviceOrderNumber ? <em>OS {item.serviceOrderNumber}</em> : null}{item.assetId ? <em>{assetName(item.assetId)}</em> : null}{item.notes ? <p>{item.notes}</p> : null}</div></li>)}</ol> : <p>Nenhuma movimentação registrada.</p>}</section>
    </div>
  </aside>;
}

export default function PartsInventoryPage({ token, notify, devices = [], serviceOrders = [], tabs = [], groups = [], segments = [], permissions = {}, onOpenAsset }) {
  const [parts, setParts] = useState([]), [categories, setCategories] = useState([]), [selected, setSelected] = useState(null), [formPart, setFormPart] = useState(undefined), [categoryModal, setCategoryModal] = useState(false), [search, setSearch] = useState(""), [inventoryState, setInventoryState] = useState(""), [discrepancyOnly, setDiscrepancyOnly] = useState(false), [viewMode, setViewMode] = useState("inventory"), [focusedKitAssetId, setFocusedKitAssetId] = useState(""), [expandedKitId, setExpandedKitId] = useState(""), [activeKitTabId, setActiveKitTabId] = useState(tabs[0]?.id || ""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const fileInput = useRef(null), reconciled = useRef(false), focusedKit = useRef(null);
  const load = useCallback(async () => { setLoading(true); try { const [partsData, categoriesData] = await Promise.all([fetchPartsInventory(token, { search, inventoryState, ...(discrepancyOnly ? { discrepancyStatus: "open" } : {}) }), fetchPartCategories(token)]); setParts(partsData.parts || []); setCategories(categoriesData.categories || []); } catch (error) { notify?.(error.message, "danger"); } finally { setLoading(false); } }, [discrepancyOnly, inventoryState, notify, search, token]);
  useEffect(() => { const timer = setTimeout(load, search ? 220 : 0); return () => clearTimeout(timer); }, [load, search]);
  useEffect(() => { if (!permissions.reconcileHardware || reconciled.current) return; reconciled.current = true; syncPartsFromAssets(token).then(({ summary }) => { if (summary.created || summary.discrepancies) load(); }).catch((error) => notify?.(error.message, "danger")); }, [load, notify, permissions.reconcileHardware, token]);
  const summary = useMemo(() => ({ catalog: parts.length, available: parts.filter((item) => item.inventoryState === "available").reduce((sum, item) => sum + item.quantity, 0), inUse: parts.filter((item) => item.inventoryState === "in_use").length, discrepancies: parts.filter(isHardwareDiscrepancy).length }), [parts]);
  const partFamilies = useMemo(() => groupPartsByFamily(parts), [parts]);
  const computerKits = useMemo(() => buildComputerKits(parts, devices), [devices, parts]);
  useEffect(() => {
    if (!tabs.length) { setActiveKitTabId(""); return; }
    if (!tabs.some((tab) => tab.id === activeKitTabId)) setActiveKitTabId(tabs[0].id);
  }, [activeKitTabId, tabs]);
  useEffect(() => {
    if (viewMode !== "kits" || !focusedKitAssetId || loading || !focusedKit.current) return;
    setExpandedKitId(focusedKitAssetId);
    focusedKit.current.focus({ preventScroll: true });
    focusedKit.current.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [computerKits, focusedKitAssetId, loading, viewMode]);
  async function openPart(part) {
    const assetId = part.assignedAssetId || part.sourceAssetId;
    if (part.inventoryState === "in_use" && assetId && !isHardwareDiscrepancy(part)) {
      const device = devices.find((item) => item.id === assetId);
      setSelected(null); setSearch(""); setDiscrepancyOnly(false); setInventoryState("in_use"); setFocusedKitAssetId(assetId); setExpandedKitId(assetId); if (device?.tabId && tabs.some((tab) => tab.id === device.tabId)) setActiveKitTabId(device.tabId); setViewMode("kits");
      return;
    }
    try { const data = await fetchPartInventoryItem(token, part.id); setSelected(data.part); } catch (error) { notify?.(error.message, "danger"); }
  }
  async function savePart(payload) { setSaving(true); try { const data = formPart?.id ? await updatePartInventoryItem(token, formPart.id, payload) : await createPartInventoryItem(token, payload); setFormPart(undefined); setSelected(data.part); notify?.("Peça salva no inventário.", "ok"); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); } }
  async function movePart(payload) { setSaving(true); try { const data = await createPartInventoryMovement(token, selected.id, payload); setSelected(data.part); notify?.("Movimentação registrada no histórico.", "ok"); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); } }
  async function reviewDiscrepancy(action) { setSaving(true); try { await reviewPartInventoryDiscrepancy(token, selected.id, action); notify?.(action === "dismiss" ? "Incongruência descartada." : "Incongruência mantida para revisão.", "ok"); setSelected(null); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); } }
  async function addCategory(name) { setSaving(true); try { await createPartCategory(token, { name }); notify?.("Categoria adicionada.", "ok"); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); } }
  async function removeCategory(id) { setSaving(true); try { await deletePartCategory(token, id); notify?.("Categoria removida da lista.", "ok"); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); } }
  async function importInvoice(file) { if (!file) return; setSaving(true); try { const xml = await file.text(); const { summary: result } = await importPartsInvoice(token, xml); notify?.(`NF-e importada: ${result.created} cadastro(s) e ${result.merged} saldo(s) atualizados.`, "ok"); await load(); } catch (error) { notify?.(error.message, "danger"); } finally { setSaving(false); if (fileInput.current) fileInput.current.value = ""; } }
  function selectView(nextView) { setViewMode(nextView); setFocusedKitAssetId(""); setExpandedKitId(""); setDiscrepancyOnly(false); setInventoryState(nextView === "kits" ? "in_use" : ""); }
  return <section className={`parts-inventory-page ${selected ? "has-inspector" : ""}`}>
    <div className="parts-inventory-main">
      <header className="parts-page-heading"><div><span><Boxes size={16} /> Controle patrimonial e de manutenção</span><h2>Inventário de Peças</h2><p>Componentes físicos organizados por família, disponibilidade e computador.</p></div><div className="parts-heading-actions">{permissions.importInvoice ? <><input ref={fileInput} className="parts-file-input" hidden type="file" accept=".xml,application/xml,text/xml" onChange={(event) => importInvoice(event.target.files?.[0])} /><button type="button" className="secondary-action parts-import-action" onClick={() => fileInput.current?.click()} disabled={saving}><FileUp size={17} /> Importar NF-e</button></> : null}{permissions.create ? <button type="button" className="primary-action" onClick={() => setFormPart(null)}><PackagePlus size={17} /> Cadastrar peça</button> : null}</div></header>
      {summary.discrepancies ? <button type="button" className="parts-alert-banner" onClick={() => { setViewMode("inventory"); setInventoryState("in_use"); setDiscrepancyOnly(true); }}><ShieldAlert /><span><strong>{summary.discrepancies} incongruência(s) aguardando conferência</strong>Abra para ver a peça divergente e localizar a máquina correspondente.</span><span>Revisar <ExternalLink size={13} /></span></button> : null}
      <div className="parts-summary"><div className="summary-catalog"><Boxes /><span>Itens rastreados<strong>{summary.catalog}</strong></span></div><div className="summary-stock"><Warehouse /><span>Unidades disponíveis<strong>{summary.available}</strong></span></div><div className="summary-installed"><Cpu /><span>Componentes em uso<strong>{summary.inUse}</strong></span></div><div className={`summary-alerts ${summary.discrepancies ? "warning" : ""}`}>{summary.discrepancies ? <TriangleAlert /> : <CheckCircle2 />}<span>Incongruências<strong>{summary.discrepancies}</strong></span></div></div>
      <div className="parts-view-tabs" aria-label="Visualização do inventário"><button type="button" className={viewMode === "inventory" ? "active" : ""} onClick={() => selectView("inventory")}><Boxes size={16} /> Peças por tipo</button><button type="button" className={viewMode === "kits" ? "active" : ""} onClick={() => selectView("kits")}><Layers3 size={16} /> Kits por computador</button></div>
      <div className="parts-toolbar"><label className="parts-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar peça, código, série, part number, MAC ou fornecedor" /></label><details className="parts-state-filter"><summary aria-label="Filtrar disponibilidade" title="Filtrar disponibilidade"><ChevronDown size={19} /></summary><div><button type="button" className={!inventoryState ? "active" : ""} onClick={() => setInventoryState("")}>Todo o inventário</button><button type="button" className={inventoryState === "available" ? "active" : ""} onClick={() => setInventoryState("available")}>Peças disponíveis</button><button type="button" className={inventoryState === "in_use" ? "active" : ""} onClick={() => setInventoryState("in_use")}>Peças em uso</button></div></details>{discrepancyOnly ? <button type="button" className="parts-clear-discrepancy" onClick={() => setDiscrepancyOnly(false)}>Limpar incongruências <X size={14} /></button> : null}{permissions.manageCategories ? <button type="button" className="icon-button parts-settings-button" onClick={() => setCategoryModal(true)} aria-label="Configurar categorias"><Settings2 /></button> : null}</div>
      {loading ? <p className="dashboard-empty-state">Atualizando o inventário...</p> : viewMode === "kits" ? (computerKits.length ? <ComputerKitsView kits={computerKits} tabs={tabs} groups={groups} segments={segments} activeTabId={activeKitTabId} onSelectTab={(tabId) => { setActiveKitTabId(tabId); setExpandedKitId(""); setFocusedKitAssetId(""); }} expandedKitId={expandedKitId} focusedKitAssetId={focusedKitAssetId} focusedKitRef={focusedKit} onToggleKit={(assetId) => { setExpandedKitId((current) => current === assetId ? "" : assetId); setFocusedKitAssetId(""); }} onOpenAsset={onOpenAsset} /> : <div className="parts-empty"><Layers3 size={34} /><strong>Nenhum kit encontrado</strong><span>Os kits aparecem quando componentes físicos são identificados em uma máquina.</span></div>) : parts.length ? <div className="parts-family-list">{partFamilies.map((family) => { const Icon = FAMILY_ICONS[family.id] || Boxes; return <section className="parts-family-section" style={{ "--family-color": family.color }} key={family.id}><header><span><Icon size={18} /></span><div><h3>{family.label}</h3><small>{family.parts.length} cadastro(s) nesta família</small></div></header><div className="parts-grid">{family.parts.map((part) => <PartCard part={part} onOpen={openPart} key={part.id} />)}</div></section>; })}</div> : <div className="parts-empty"><Boxes size={34} /><strong>Nenhuma peça encontrada</strong><span>Cadastre um item ou importe uma NF-e. Os ativos monitorados são conciliados automaticamente.</span></div>}
    </div>
    {selected ? <PartInspector part={selected} devices={devices} serviceOrders={serviceOrders} permissions={permissions} saving={saving} onClose={() => setSelected(null)} onEdit={() => setFormPart(selected)} onMove={movePart} onOpenAsset={onOpenAsset} onReviewDiscrepancy={reviewDiscrepancy} /> : null}
    {formPart !== undefined ? <PartForm part={formPart} categories={categories} saving={saving} onClose={() => setFormPart(undefined)} onSave={savePart} /> : null}
    {categoryModal ? <CategoryModal categories={categories} saving={saving} onClose={() => setCategoryModal(false)} onCreate={addCategory} onDelete={removeCategory} /> : null}
  </section>;
}
