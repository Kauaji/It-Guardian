import { useEffect, useRef, useState } from "react";
import { ChevronDown, XCircle } from "lucide-react";

function formatDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
  asset_list: "Maquinas selecionadas",
  segment: "Segmento",
  group: "Grupo"
};

const preventiveAutomationColorOptions = ["#1f7a61", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0f766e"];

const preventiveAutomationTimezoneOptions = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Rio_Branco",
  "UTC"
];

function normalizeAutomationColor(color, fallback = "#1f7a61") {
  return /^#[0-9a-f]{6}$/i.test(String(color || "").trim()) ? String(color).trim().toLowerCase() : fallback;
}

function getDefaultRecurrenceInterval(type) {
  if (type === "daily") return 1;
  if (type === "weekly") return 7;
  if (type === "biweekly") return 15;
  return 30;
}

function getPlanRecurrenceIntervalDays(plan) {
  return Number(plan?.recurrenceIntervalDays || plan?.recurrenceInterval || getDefaultRecurrenceInterval(plan?.recurrenceType));
}

export default function PreventiveAutomationPanel({
  variant = "standalone",
  plans = [],
  scripts = [],
  devices = [],
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  canCreate,
  canUpdate,
  canDisable,
  createRequest = null,
  onSave,
  onDisable,
  onCreateAutomatedPreventivePlan,
  onCreateRequestHandled
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
    assetIds: [],
    defaultScriptIds: [],
    notes: "",
    indicatorColor: "#1f7a61",
    overrides: []
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [wizardMode, setWizardMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [wizardContext, setWizardContext] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState({
    targetType: "segment",
    targetId: "",
    recurrenceType: "monthly",
    recurrenceInterval: 30,
    preferredTime: "08:00"
  });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const lastCreateRequestId = useRef(null);
  const activeScripts = scripts.filter((script) => script.active !== false);
  const normalizedFormName = form.name.trim().toLocaleLowerCase("pt-BR");
  const normalizedFormColor = normalizeAutomationColor(form.indicatorColor).toLowerCase();
  const duplicateNamePlan = plans.find(
    (plan) =>
      String(plan.id) !== String(form.id || "") &&
      String(plan.name || "").trim().toLocaleLowerCase("pt-BR") === normalizedFormName
  );
  const duplicateColorPlan = plans.find(
    (plan) =>
      String(plan.id) !== String(form.id || "") &&
      normalizeAutomationColor(plan.indicatorColor).toLowerCase() === normalizedFormColor
  );
  const hasDuplicateAutomationIdentity = Boolean(
    (normalizedFormName && duplicateNamePlan) || duplicateColorPlan
  );

  useEffect(() => {
    if (!modalOpen) return undefined;

    function handleKeydown(event) {
      if (event.key === "Escape") {
        setModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [modalOpen]);

  useEffect(() => {
    if (!createRequest?.id || lastCreateRequestId.current === createRequest.id) return;
    lastCreateRequestId.current = createRequest.id;
    openCreateModal(createRequest.defaults || {}, { wizard: true });
    onCreateRequestHandled?.(createRequest.id);
  }, [createRequest, onCreateRequestHandled]);

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
    if (plan.scopeType === "asset_list") {
      const count = Array.isArray(plan.assetIds) ? plan.assetIds.length : 0;
      return `${preventiveAutomationScopeLabels.asset_list}: ${count} maquina(s)`;
    }
    const option = getScopeOptions(plan.scopeType).find((item) => String(item.id) === String(plan.scopeId));
    return `${preventiveAutomationScopeLabels[plan.scopeType] || "Escopo"}: ${option?.label || plan.scopeId || "não informado"}`;
  }

  function getRecurrenceLabel(plan) {
    const label = preventiveAutomationRecurrenceLabels[plan.recurrenceType] || plan.recurrenceType || "Mensal";
    return `${label} - a cada ${getPlanRecurrenceIntervalDays(plan)} dia(s)`;
  }

  function getRecurrenceShortLabel(plan) {
    if (plan.recurrenceType === "custom_days") {
      return `A cada ${getPlanRecurrenceIntervalDays(plan)} dia(s)`;
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

  function buildAutomationPayload() {
    const recurrenceInterval = form.recurrenceType === "custom_days"
      ? Number(form.recurrenceInterval)
      : getDefaultRecurrenceInterval(form.recurrenceType);

    return {
      name: form.name,
      description: form.description,
      active: form.active,
      recurrenceType: form.recurrenceType,
      recurrenceInterval,
      recurrenceIntervalDays: recurrenceInterval,
      preferredTime: form.preferredTime,
      timezone: form.timezone,
      scopeType: form.scopeType,
      scopeId: form.scopeType === "all" || form.scopeType === "asset_list" ? null : form.scopeId,
      assetIds: form.scopeType === "asset_list" ? form.assetIds || [] : [],
      defaultScriptIds: form.defaultScriptIds,
      notes: form.notes,
      indicatorColor: normalizeAutomationColor(form.indicatorColor),
      overrides: (form.overrides || []).map((item) => ({
        assetId: item.assetId || null,
        segmentId: item.segmentId || null,
        recurrenceType: item.recurrenceType,
        recurrenceInterval: Number(item.recurrenceInterval || 30),
        recurrenceIntervalDays: Number(item.recurrenceIntervalDays || item.recurrenceInterval || getDefaultRecurrenceInterval(item.recurrenceType)),
        preferredTime: item.preferredTime || null,
        active: item.active !== false
      }))
    };
  }

  function openCreateModal(defaults = {}, options = {}) {
    const { context = null, ...formDefaults } = defaults;
    const nextWizardMode = options.wizard || defaults.wizardMode === true;
    setWizardMode(nextWizardMode);
    setReviewMode(false);
    setWizardContext(context);
    setForm((current) => {
      const shouldPreserveWizardDraft =
        nextWizardMode &&
        wizardMode &&
        current.id == null;

      const base = shouldPreserveWizardDraft ? current : emptyForm;

      return {
        ...base,
        ...formDefaults,
        id: null,
        active: formDefaults.active ?? base.active ?? true,
        assetIds: Array.isArray(formDefaults.assetIds) ? formDefaults.assetIds : base.assetIds || [],
        defaultScriptIds: Array.isArray(formDefaults.defaultScriptIds) ? formDefaults.defaultScriptIds : base.defaultScriptIds || [],
        overrides: Array.isArray(formDefaults.overrides) ? formDefaults.overrides : base.overrides || [],
        indicatorColor: normalizeAutomationColor(formDefaults.indicatorColor || base.indicatorColor)
      };
    });
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
    setWizardMode(false);
    setReviewMode(false);
    setWizardContext(null);
    setForm({
      id: plan.id,
      name: plan.name || "",
      description: plan.description || "",
      active: plan.active !== false,
      recurrenceType: plan.recurrenceType || "monthly",
      recurrenceInterval: getPlanRecurrenceIntervalDays(plan),
      preferredTime: plan.preferredTime || "08:00",
      timezone: plan.timezone || "America/Sao_Paulo",
      scopeType: plan.scopeType || "all",
      scopeId: plan.scopeId || "",
      assetIds: Array.isArray(plan.assetIds) ? plan.assetIds : [],
      defaultScriptIds: Array.isArray(plan.defaultScriptIds) ? plan.defaultScriptIds : [],
      notes: plan.notes || "",
      indicatorColor: normalizeAutomationColor(plan.indicatorColor),
      overrides: Array.isArray(plan.overrides) ? plan.overrides : []
    });
    setOverridesOpen(false);
    setModalOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "scopeType" ? { scopeId: "", assetIds: value === "asset_list" ? current.assetIds || [] : [] } : {}),
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
    const targetKey = `${overrideDraft.targetType}:${overrideDraft.targetId}`;
    const alreadyExists = (form.overrides || []).some((item) => {
      const itemType = item.assetId ? "asset" : "segment";
      const itemId = item.assetId || item.segmentId;
      return `${itemType}:${itemId}` === targetKey;
    });
    if (alreadyExists) return;
    const recurrenceInterval = Number(overrideDraft.recurrenceInterval || getDefaultRecurrenceInterval(overrideDraft.recurrenceType));
    if (overrideDraft.recurrenceType === "custom_days" && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 365)) {
      return;
    }
    setForm((current) => ({
      ...current,
      overrides: [
        ...(current.overrides || []),
        {
          id: `draft-${Date.now()}`,
          assetId: overrideDraft.targetType === "asset" ? overrideDraft.targetId : null,
          segmentId: overrideDraft.targetType === "segment" ? overrideDraft.targetId : null,
          recurrenceType: overrideDraft.recurrenceType,
          recurrenceInterval,
          recurrenceIntervalDays: recurrenceInterval,
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
    if ((!onSave && !onCreateAutomatedPreventivePlan) || saving || hasDuplicateAutomationIdentity) return;
    const recurrenceInterval = form.recurrenceType === "custom_days"
      ? Number(form.recurrenceInterval)
      : getDefaultRecurrenceInterval(form.recurrenceType);
    if (form.recurrenceType === "custom_days" && (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > 365)) {
      return;
    }
    if (wizardMode && !reviewMode) {
      setReviewMode(true);
      return;
    }
    setSaving(true);
    try {
      const automationPayload = buildAutomationPayload();
      if (wizardMode && !form.id && onCreateAutomatedPreventivePlan) {
        await onCreateAutomatedPreventivePlan(automationPayload, wizardContext);
      } else {
        await onSave(form.id, automationPayload);
      }
      setModalOpen(false);
      setReviewMode(false);
    } finally {
      setSaving(false);
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
        recurrenceInterval: getPlanRecurrenceIntervalDays(plan),
        recurrenceIntervalDays: getPlanRecurrenceIntervalDays(plan),
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
    <section className={`panel preventive-automation-panel ${variant === "embedded" ? "embedded" : ""}`}>
      {variant !== "embedded" && (
        <>
          <div className="panel-heading">
            <div>
              <h2>Automação Preventiva</h2>
              <p>A automação agenda e prepara rotinas. A execução real dependerá de agente seguro.</p>
            </div>
            {canCreate && (
              <button type="button" className="primary-action compact-action" onClick={() => openCreateModal()}>
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
                    <dt>Horário</dt>
                    <dd>{plan.preferredTime || "08:00"} - {plan.timezone || "America/Sao_Paulo"}</dd>
                  </div>
                  <div>
                    <dt>Escopo</dt>
                    <dd>{getScopeLabel(plan)}</dd>
                  </div>
                  <div>
                    <dt>Próxima preparação</dt>
                    <dd>{formatDate(plan.nextRunAt || plan.nextScheduledFor)}</dd>
                  </div>
                  <div>
                    <dt>Exceções</dt>
                    <dd>{Array.isArray(plan.overrides) && plan.overrides.length ? `${plan.overrides.length} personalizada(s)` : "Sem exceções"}</dd>
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
                </footer>
              </article>
            ))}

            {!plans.length && <p className="empty">Nenhum plano de automação preventiva cadastrado ainda.</p>}
          </div>
        </>
      )}

      {modalOpen && (
        <div className="modal-backdrop preventive-automation-backdrop" role="presentation">
          <form className={`modal-panel preventive-automation-modal ${wizardMode ? "wizard-mode" : ""}`} onSubmit={submitForm}>
            <header>
              <div>
                <span>{wizardMode ? "Etapa 3" : "Automação Preventiva"}</span>
                <h2>
                  {reviewMode
                    ? "Revisar plano automatizado"
                    : wizardMode
                      ? "Configurar automatização"
                      : form.id ? "Editar plano" : "Novo plano"}
                </h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setModalOpen(false)} aria-label="Fechar">
                <XCircle size={18} />
              </button>
            </header>

            {wizardMode && wizardContext && (
              <section className="preventive-automation-context">
                <div>
                  <span>Plano atual</span>
                  <strong>{form.name || "Plano preventivo automatizado"}</strong>
                </div>
                <div>
                  <span>Máquinas herdadas</span>
                  <strong>{wizardContext.assetCount || 0}</strong>
                  <small>{wizardContext.assetNames?.slice(0, 4).join(", ") || "Nenhuma máquina selecionada"}</small>
                </div>
                <div>
                  <span>Verificações herdadas</span>
                  <strong>{form.defaultScriptIds.length}</strong>
                  <small>{wizardContext.scriptNames?.slice(0, 4).join(", ") || "Nenhum script selecionado"}</small>
                </div>
              </section>
            )}

            {reviewMode ? (
              <section className="preventive-automation-review">
                <header>
                  <div>
                    <span>Revisão final</span>
                    <h3>{form.name}</h3>
                    <p>Nenhum comando será executado nesta etapa. O sistema apenas registra e prepara a agenda preventiva.</p>
                  </div>
                  <span className="automation-color-dot" style={{ background: normalizeAutomationColor(form.indicatorColor) }} />
                </header>
                <dl>
                  <div>
                    <dt>Máquinas</dt>
                    <dd>{wizardContext?.assetNames?.join(", ") || getScopeLabel(form)}</dd>
                  </div>
                  <div>
                    <dt>Scripts</dt>
                    <dd>{activeScripts.filter((script) => form.defaultScriptIds.includes(script.id)).map((script) => script.name).join(", ") || "Nenhum script selecionado"}</dd>
                  </div>
                  <div>
                    <dt>Recorrência</dt>
                    <dd>{getRecurrenceLabel(form)}</dd>
                  </div>
                  <div>
                    <dt>Horário e fuso</dt>
                    <dd>{form.preferredTime || "08:00"} - {form.timezone || "America/Sao_Paulo"}</dd>
                  </div>
                  <div>
                    <dt>Escopo</dt>
                    <dd>{getScopeLabel(form)}</dd>
                  </div>
                  <div>
                    <dt>Cor</dt>
                    <dd>{normalizeAutomationColor(form.indicatorColor)}</dd>
                  </div>
                  <div>
                    <dt>Exceções</dt>
                    <dd>{form.overrides.length ? `${form.overrides.length} recorrência(s) personalizada(s)` : "Sem exceções"}</dd>
                  </div>
                  <div>
                    <dt>Observações</dt>
                    <dd>{form.notes || form.description || "Sem observações"}</dd>
                  </div>
                </dl>
              </section>
            ) : (
              <>
            <div className="preventive-automation-form-grid">
              <label>
                Nome
                <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} required />
                {duplicateNamePlan && (
                  <span className="form-error">Já existe uma automatização com esse nome.</span>
                )}
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
                    required
                  />
                </label>
              )}
              <label>
                Horário preferencial
                <input type="time" value={form.preferredTime} onChange={(event) => updateForm("preferredTime", event.target.value)} />
              </label>
              <label>
                Fuso horário
                <select value={form.timezone} onChange={(event) => updateForm("timezone", event.target.value)}>
                  {preventiveAutomationTimezoneOptions.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="automation-color-field">
                Cor de identificação do plano
                <div>
                  <span className="automation-color-dot" style={{ background: normalizeAutomationColor(form.indicatorColor) }} />
                  <input
                    type="color"
                    value={normalizeAutomationColor(form.indicatorColor)}
                    onChange={(event) => updateForm("indicatorColor", event.target.value)}
                    aria-label="Escolher cor do plano"
                  />
                  <input
                    value={form.indicatorColor}
                    onChange={(event) => updateForm("indicatorColor", event.target.value)}
                    onBlur={(event) => updateForm("indicatorColor", normalizeAutomationColor(event.target.value))}
                    aria-label="Valor hexadecimal da cor"
                  />
                </div>
                {duplicateColorPlan && (
                  <span className="form-error">Essa cor já identifica a automatização "{duplicateColorPlan.name}".</span>
                )}
                <div className="automation-color-palette" aria-label="Cores sugeridas">
                  {preventiveAutomationColorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={normalizeAutomationColor(form.indicatorColor) === color ? "active" : ""}
                      style={{ background: color }}
                      onClick={() => updateForm("indicatorColor", color)}
                      disabled={plans.some(
                        (plan) =>
                          String(plan.id) !== String(form.id || "") &&
                          normalizeAutomationColor(plan.indicatorColor) === color
                      )}
                      aria-label={`Usar cor ${color}`}
                    />
                  ))}
                </div>
              </label>
              <label>
                Escopo
                <select value={form.scopeType} onChange={(event) => updateForm("scopeType", event.target.value)}>
                  {Object.entries(preventiveAutomationScopeLabels)
                    .filter(([value]) => value !== "asset_list" || form.scopeType === "asset_list")
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                </select>
              </label>
              {form.scopeType === "asset_list" && (
                <div className="preventive-automation-wide automation-asset-list-scope">
                  <strong>Maquinas selecionadas</strong>
                  <span>{(form.assetIds || []).length} maquina(s) herdada(s) da preventiva.</span>
                  <div>
                    {(form.assetIds || []).map((assetId) => {
                      const device = devices.find((item) => String(item.id) === String(assetId));
                      const label = device?.name || device?.hostname || assetId;
                      return (
                        <em key={assetId}>
                          {label} <small>{assetId}</small>
                        </em>
                      );
                    })}
                  </div>
                </div>
              )}
              {form.scopeType !== "all" && form.scopeType !== "asset_list" && (
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
                    {overrideDraft.recurrenceType === "custom_days" && (
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={overrideDraft.recurrenceInterval}
                        onChange={(event) => setOverrideDraft((current) => ({
                          ...current,
                          recurrenceInterval: event.target.value
                        }))}
                        aria-label="Dias da recorrência personalizada"
                      />
                    )}
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
              </>
            )}

            <footer>
              {wizardMode && !reviewMode ? (
                <button type="button" className="secondary-action compact-action" onClick={() => setModalOpen(false)} disabled={saving}>
                  Voltar às verificações
                </button>
              ) : reviewMode ? (
                <button type="button" className="secondary-action compact-action" onClick={() => setReviewMode(false)} disabled={saving}>
                  Voltar à automatização
                </button>
              ) : (
                <button type="button" className="secondary-action compact-action" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="primary-action compact-action"
                disabled={saving || hasDuplicateAutomationIdentity}
              >
                {saving
                  ? "Salvando..."
                  : wizardMode
                    ? reviewMode ? "Salvar plano automatizado" : "Revisar plano automatizado"
                    : "Salvar plano"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
