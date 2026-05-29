import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Building2, ListChecks, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload, UserCog, X } from "lucide-react";
import {
  createClient,
  createPriorityRule,
  createProblemType,
  createProduct,
  createService,
  createTechnician,
  deleteClient,
  deletePriorityRule,
  deleteProblemType,
  deleteProduct,
  deleteService,
  deleteTechnician,
  fetchClients,
  fetchPriorityRules,
  fetchProblemTypes,
  fetchProducts,
  fetchServices,
  fetchTechnicians,
  importClients,
  importProducts,
  updateClient,
  updatePriorityRule,
  updateProblemType,
  updateProduct,
  updateService,
  updateTechnician
} from "../../api.js";

const sections = [
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "products", label: "Peças", icon: Boxes },
  { id: "services", label: "Serviços", icon: ListChecks },
  { id: "technicians", label: "Técnicos", icon: UserCog },
  { id: "problemTypes", label: "Tipos de Problema", icon: ListChecks },
  { id: "priorityRules", label: "Regras de Prioridade", icon: SlidersHorizontal }
];

const priorityOptions = [
  { value: "", label: "Sem prioridade padrão" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" }
];

const requiredPriorityOptions = priorityOptions.filter((option) => option.value);
const defaultProblemCategories = [
  "Computador",
  "Notebook",
  "Servidor",
  "Impressora",
  "Teclado",
  "Mouse",
  "Monitor",
  "Rede",
  "Sistema",
  "Outro"
];

const ruleTypeOptions = [
  { value: "client", label: "Prioridade por cliente" },
  { value: "sector", label: "Prioridade por setor" },
  { value: "problem_type", label: "Prioridade por tipo de problema" },
  { value: "service", label: "Prioridade por serviço" },
  { value: "category", label: "Prioridade por categoria" },
  { value: "open_time", label: "Tempo da ordem aberta" },
  { value: "equipment_category", label: "Categoria do equipamento" }
];

const configs = {
  clients: {
    singular: "cliente",
    plural: "clientes",
    searchLabel: "clientes",
    titleField: "tradeName",
    importable: true,
    create: createClient,
    update: updateClient,
    remove: deleteClient,
    fetch: fetchClients,
    importCsv: importClients,
    fields: [
      { name: "tradeName", label: "Nome fantasia", required: true },
      { name: "legalName", label: "Razão social" },
      { name: "document", label: "CNPJ" },
      { name: "phone", label: "Telefone" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Endereço", wide: true },
      { name: "contactName", label: "Responsável" },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "tradeName", label: "Cliente" },
      { key: "document", label: "CNPJ" },
      { key: "phone", label: "Telefone" },
      { key: "contactName", label: "Responsável" },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  products: {
    singular: "peça",
    plural: "produtos",
    searchLabel: "peças",
    titleField: "name",
    importable: true,
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
    fetch: fetchProducts,
    importCsv: importProducts,
    fields: [
      { name: "name", label: "Nome do produto", required: true },
      { name: "category", label: "Categoria" },
      { name: "brand", label: "Marca" },
      { name: "model", label: "Modelo" },
      { name: "internalCode", label: "Código interno" },
      { name: "assetTag", label: "Patrimônio", internalOnly: true },
      { name: "quantity", label: "Quantidade", type: "number" },
      { name: "unitPrice", label: "Valor unitário", type: "currency", businessOnly: true },
      { name: "unit", label: "Unidade" }
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "category", label: "Categoria" },
      { key: "internalCode", label: "Código" },
      { key: "assetTag", label: "Patrimônio", internalOnly: true },
      { key: "quantity", label: "Qtd." },
      { key: "unitPrice", label: "Valor", type: "currency", businessOnly: true }
    ]
  },
  services: {
    singular: "serviço",
    plural: "serviços",
    searchLabel: "serviços",
    titleField: "name",
    importable: false,
    create: createService,
    update: updateService,
    remove: deleteService,
    fetch: fetchServices,
    fields: [
      { name: "code", label: "Código" },
      { name: "name", label: "Nome do serviço", required: true },
      { name: "description", label: "Descrição", type: "textarea", wide: true },
      { name: "category", label: "Categoria" },
      { name: "defaultPriority", label: "Prioridade padrão", type: "select", options: priorityOptions },
      { name: "defaultValue", label: "Valor do serviço", type: "currency" },
      { name: "active", label: "Status", type: "status" }
    ],
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Serviço" },
      { key: "category", label: "Categoria" },
      { key: "defaultPriority", label: "Prioridade", type: "priority" },
      { key: "defaultValue", label: "Valor", type: "currency" },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  technicians: {
    singular: "técnico",
    plural: "técnicos",
    searchLabel: "técnicos",
    titleField: "name",
    importable: false,
    create: createTechnician,
    update: updateTechnician,
    remove: deleteTechnician,
    fetch: fetchTechnicians,
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "email", label: "E-mail", type: "email" },
      { name: "phone", label: "Telefone" },
      { name: "role", label: "Cargo/função" },
      { name: "specialty", label: "Especialidade" },
      { name: "allowedClientIds", label: "Clientes permitidos", type: "clientMulti", businessOnly: true },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "name", label: "Técnico" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "specialty", label: "Especialidade" },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  problemTypes: {
    singular: "tipo de problema",
    plural: "problemTypes",
    searchLabel: "tipos de problema",
    titleField: "name",
    importable: false,
    create: createProblemType,
    update: updateProblemType,
    remove: deleteProblemType,
    fetch: fetchProblemTypes,
    fields: [
      { name: "name", label: "Nome do problema", required: true },
      { name: "category", label: "Categoria associada", type: "category" },
      { name: "defaultPriority", label: "Prioridade padrao", type: "select", options: priorityOptions }
    ],
    columns: [
      { key: "name", label: "Problema" },
      { key: "category", label: "Categoria" },
      { key: "defaultPriority", label: "Prioridade", type: "priority" }
    ]
  },
  priorityRules: {
    singular: "regra",
    plural: "priorityRules",
    searchLabel: "regras de prioridade",
    titleField: "name",
    importable: false,
    create: createPriorityRule,
    update: updatePriorityRule,
    remove: deletePriorityRule,
    fetch: fetchPriorityRules,
    fields: [
      { name: "name", label: "Nome da regra", required: true },
      { name: "ruleType", label: "Tipo da regra", type: "select", options: ruleTypeOptions },
      { name: "targetValue", label: "Alvo/valor da regra" },
      { name: "priority", label: "Prioridade sugerida", type: "select", options: requiredPriorityOptions },
      { name: "thresholdHours", label: "Horas limite", type: "number" },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "name", label: "Regra" },
      { key: "ruleType", label: "Tipo", type: "ruleType" },
      { key: "targetValue", label: "Alvo" },
      { key: "priority", label: "Prioridade", type: "priority" },
      { key: "active", label: "Status", type: "status" }
    ]
  }
};

function emptyRecord(config) {
  return config.fields.reduce((record, field) => {
    record[field.name] = field.type === "status"
      ? true
      : field.type === "number"
        ? 0
        : field.type === "clientMulti"
          ? []
          : "";
    return record;
  }, {});
}

function renderCell(record, column) {
  const value = record[column.key];
  if (column.type === "status") {
    return <span className={`settings-status ${value ? "active" : "inactive"}`}>{value ? "Ativo" : "Inativo"}</span>;
  }
  if (column.type === "priority") {
    return priorityOptions.find((option) => option.value === value)?.label || "Não definida";
  }
  if (column.type === "ruleType") {
    return ruleTypeOptions.find((option) => option.value === value)?.label || value || "Não informado";
  }
  if (column.type === "currency") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }
  return value || "Não informado";
}

function buildProblemCategories(records = []) {
  const categories = records
    .map((record) => record.category)
    .filter(Boolean);
  return [...new Set([...defaultProblemCategories, ...categories])];
}

function SettingsFormModal({ sectionId, record, records = [], businessMode, clients = [], onClose, onSubmit, saving }) {
  const config = configs[sectionId];
  const visibleFields = config.fields.filter((field) =>
    (!field.businessOnly || businessMode) && (!field.internalOnly || !businessMode)
  );
  const [form, setForm] = useState(() => ({ ...emptyRecord(config), ...(record || {}) }));
  const [categoryOptions, setCategoryOptions] = useState(() => buildProblemCategories(records));

  useEffect(() => {
    setForm({ ...emptyRecord(config), ...(record || {}) });
  }, [record, sectionId]);

  useEffect(() => {
    setCategoryOptions(buildProblemCategories(records));
  }, [records]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function addCategoryOption() {
    const name = window.prompt("Nova categoria");
    const normalizedName = name?.trim();
    if (!normalizedName) return;

    setCategoryOptions((current) => {
      const next = [...new Set([...current, normalizedName])];
      return next;
    });
    updateField("category", normalizedName);
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="modal-backdrop settings-modal-backdrop" role="presentation">
      <form className="modal-panel settings-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <h2>{record ? "Editar" : "Novo"} {config.singular}</h2>
            <p>Cadastro usado nas Ordens de Serviço.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {visibleFields.map((field) => (
          <label key={field.name} className={field.wide ? "settings-wide-field" : ""}>
            {field.label}
            {field.type === "textarea" ? (
              <textarea
                value={form[field.name] || ""}
                onChange={(event) => updateField(field.name, event.target.value)}
              />
            ) : field.type === "status" ? (
              <select
                value={form[field.name] ? "active" : "inactive"}
                onChange={(event) => updateField(field.name, event.target.value === "active")}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            ) : field.type === "select" ? (
              <select
                value={form[field.name] ?? ""}
                onChange={(event) => updateField(field.name, event.target.value)}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === "category" ? (
              <div className="settings-category-input">
                <select
                  value={form[field.name] ?? ""}
                  onChange={(event) => updateField(field.name, event.target.value)}
                >
                  <option value="">Selecione uma categoria</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  onClick={addCategoryOption}
                  title="Adicionar categoria"
                  aria-label="Adicionar categoria"
                >
                  <Plus size={15} />
                </button>
              </div>
            ) : field.type === "clientMulti" ? (
              <select
                multiple
                size={Math.min(6, Math.max(3, clients.length || 3))}
                value={form[field.name] || []}
                onChange={(event) =>
                  updateField(field.name, Array.from(event.target.selectedOptions).map((option) => option.value))
                }
              >
                {clients.length ? clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.tradeName || client.legalName || client.name}
                  </option>
                )) : (
                  <option value="" disabled>Nenhum cliente cadastrado</option>
                )}
              </select>
            ) : field.type === "currency" ? (
              <input
                type="text"
                inputMode="decimal"
                value={form[field.name] ?? ""}
                onChange={(event) => updateField(field.name, event.target.value)}
                placeholder="R$ 0,00"
              />
            ) : (
              <input
                type={field.type || "text"}
                value={form[field.name] ?? ""}
                min={field.type === "number" ? 0 : undefined}
                required={field.required}
                onChange={(event) => updateField(field.name, event.target.value)}
              />
            )}
          </label>
        ))}

        <div className="modal-actions settings-wide-field">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SettingsView({
  token,
  notify,
  systemMode = "local",
  forcedSection = "",
  hideHero = false,
  hideTabs = false
}) {
  const [internalSectionId, setInternalSectionId] = useState(forcedSection || "clients");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const sectionId = forcedSection || internalSectionId;
  const config = configs[sectionId];
  const businessMode = systemMode === "business";
  const visibleColumns = config.columns.filter((column) =>
    (!column.businessOnly || businessMode) && (!column.internalOnly || !businessMode)
  );
  const tableColumns = `repeat(${visibleColumns.length}, minmax(120px, 1fr)) 120px`;

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      Object.values(record).some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [records, search]);

  async function loadRecords() {
    try {
      const response = await config.fetch(token, { search });
      setRecords(response[sectionId] || response[config.plural] || []);
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  async function loadClientOptions() {
    if (!businessMode || sectionId !== "technicians") return;
    try {
      const response = await fetchClients(token);
      setClientOptions((response.clients || []).filter((client) => client.active !== false));
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  useEffect(() => {
    loadRecords();
  }, [sectionId]);

  useEffect(() => {
    loadClientOptions();
  }, [businessMode, sectionId]);

  useEffect(() => {
    if (!forcedSection) return;
    setSearch("");
    setEditingRecord(null);
    setFormOpen(false);
  }, [forcedSection]);

  function openCreate() {
    setEditingRecord(null);
    setFormOpen(true);
  }

  function openEdit(record) {
    setEditingRecord(record);
    setFormOpen(true);
  }

  async function saveRecord(payload) {
    setSaving(true);
    try {
      if (editingRecord) {
        await config.update(token, editingRecord.id, payload);
        notify?.("Cadastro atualizado.", "ok");
      } else {
        await config.create(token, payload);
        notify?.("Cadastro criado.", "ok");
      }

      setFormOpen(false);
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record) {
    const name = record[config.titleField] || config.singular;
    if (!window.confirm(`Excluir "${name}"?`)) return;

    try {
      await config.remove(token, record.id);
      notify?.("Cadastro excluido.", "ok");
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify?.("Por enquanto a importacao aceita CSV. Excel ficara preparado para uma proxima etapa.", "danger");
      return;
    }

    try {
      const csv = await file.text();
      const response = await config.importCsv(token, csv);
      notify?.(`${response.imported} registros importados. ${response.errors?.length || 0} erros.`, response.errors?.length ? "danger" : "ok");
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  return (
    <section className="settings-view">
      {!hideHero && <header className="settings-hero">
        <div>
          <span className="section-eyebrow">Fase 2</span>
          <h2>Configurações</h2>
          <p>
            {businessMode
              ? "Modo Business ativo: clientes, técnicos, produtos e regras ajudam a deixar a OS mais completa."
            : "Modo Local ativo: setores e serviços organizam atendimentos internos sem exigir cliente."}
          </p>
        </div>
      </header>}

      {!hideTabs && <div className="settings-tabs">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              className={sectionId === section.id ? "active" : ""}
              onClick={() => {
                setInternalSectionId(section.id);
                setSearch("");
              }}
            >
              <Icon size={17} />
              {section.label}
            </button>
          );
        })}
      </div>}

      <section className="settings-panel">
        <header className="settings-toolbar">
          <div className="search-box settings-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar ${config.searchLabel || config.plural}`}
            />
          </div>
          <div className="settings-actions">
            {config.importable && (
              <>
                <button type="button" className="secondary-action compact-action" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={16} />
                  Importar
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  hidden
                  onChange={importFile}
                />
              </>
            )}
            <button type="button" className="primary-action compact-action" onClick={openCreate}>
              Novo {config.singular}
            </button>
          </div>
        </header>

        <div className="settings-table">
          <div className="settings-table-head" style={{ gridTemplateColumns: tableColumns }}>
            {visibleColumns.map((column) => <span key={column.key}>{column.label}</span>)}
            <span className="settings-actions-heading" aria-hidden="true" />
          </div>
          {filteredRecords.length ? filteredRecords.map((record) => (
            <article key={record.id} className="settings-table-row" style={{ gridTemplateColumns: tableColumns }}>
              {visibleColumns.map((column) => (
                <span key={column.key}>{renderCell(record, column)}</span>
              ))}
              <div className="settings-row-actions">
                <button type="button" className="icon-button" onClick={() => openEdit(record)} title="Editar">
                  <Pencil size={16} />
                </button>
                <button type="button" className="icon-button danger" onClick={() => removeRecord(record)} title="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          )) : (
            <p className="empty settings-empty">Nenhum cadastro encontrado.</p>
          )}
        </div>
      </section>

      {formOpen && (
        <SettingsFormModal
          sectionId={sectionId}
          record={editingRecord}
          records={records}
          businessMode={businessMode}
          clients={clientOptions}
          saving={saving}
          onClose={() => setFormOpen(false)}
          onSubmit={saveRecord}
        />
      )}
    </section>
  );
}
