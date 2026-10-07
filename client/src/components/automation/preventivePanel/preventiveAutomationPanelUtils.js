// Regras puras do formulario de automacao preventiva: rotulos, valores padrao,
// montagem de payloads e validacoes simples. Sem React, para testar isoladamente.
import { automationColorOptions } from "../automationFormUtils.js";

export const preventiveAutomationRecurrenceLabels = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom_days: "Personalizada em dias"
};

export const preventiveAutomationScopeLabels = {
  all: "Todas as máquinas",
  asset: "Máquina",
  asset_list: "Máquinas selecionadas",
  segment: "Segmento",
  group: "Grupo"
};

export const preventiveAutomationColorOptions = automationColorOptions;

export const preventiveAutomationTimezoneOptions = [
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

export function formatPanelDate(value) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function normalizeAutomationColor(color, fallback = "#1f7a61") {
  return /^#[0-9a-f]{6}$/i.test(String(color || "").trim()) ? String(color).trim().toLowerCase() : fallback;
}

export function getDefaultRecurrenceInterval(type) {
  if (type === "daily") return 1;
  if (type === "weekly") return 7;
  if (type === "biweekly") return 15;
  return 30;
}

export function getPlanRecurrenceIntervalDays(plan) {
  return Number(plan?.recurrenceIntervalDays || plan?.recurrenceInterval || getDefaultRecurrenceInterval(plan?.recurrenceType));
}

export function isInvalidCustomInterval(recurrenceType, interval) {
  return recurrenceType === "custom_days" && (!Number.isInteger(interval) || interval < 1 || interval > 365);
}

export function buildEmptyAutomationForm() {
  return {
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
}

export function buildEmptyOverrideDraft() {
  return {
    targetType: "segment",
    targetId: "",
    recurrenceType: "monthly",
    recurrenceInterval: 30,
    preferredTime: "08:00"
  };
}

export function buildAutomationFormFromPlan(plan) {
  return {
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
  };
}

// Aplica os padroes recebidos (ex.: selecao vinda da aba Preventivas) sobre o
// formulario. No assistente, um rascunho de criacao ja iniciado e preservado.
export function buildAutomationFormFromDefaults(current, formDefaults, preserveWizardDraft) {
  const shouldPreserve = preserveWizardDraft && current.id == null;
  const base = shouldPreserve ? current : buildEmptyAutomationForm();

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
}

// Aplica uma alteracao de campo, reiniciando os campos dependentes (escopo e intervalo).
export function applyAutomationFormField(current, field, value) {
  return {
    ...current,
    [field]: value,
    ...(field === "scopeType" ? { scopeId: "", assetIds: value === "asset_list" ? current.assetIds || [] : [] } : {}),
    ...(field === "recurrenceType" ? { recurrenceInterval: getDefaultRecurrenceInterval(value) } : {})
  };
}

export function toggleListItem(list = [], item) {
  const ids = new Set(list);
  if (ids.has(item)) ids.delete(item);
  else ids.add(item);
  return [...ids];
}

export function resolveFormRecurrenceInterval(form) {
  return form.recurrenceType === "custom_days" ? Number(form.recurrenceInterval) : getDefaultRecurrenceInterval(form.recurrenceType);
}

export function buildAutomationPayload(form) {
  const recurrenceInterval = resolveFormRecurrenceInterval(form);

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
      recurrenceIntervalDays: Number(
        item.recurrenceIntervalDays || item.recurrenceInterval || getDefaultRecurrenceInterval(item.recurrenceType)
      ),
      preferredTime: item.preferredTime || null,
      active: item.active !== false
    }))
  };
}

// Payload enviado ao reativar um plano pelo interruptor da lista.
export function buildReactivationPayload(plan) {
  return {
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
  };
}

function overrideTarget(item) {
  return { type: item.assetId ? "asset" : "segment", id: item.assetId || item.segmentId };
}

// Cria a excecao de recorrencia a partir do rascunho. Retorna null quando o
// alvo falta, ja existe ou o intervalo personalizado e invalido.
export function buildOverrideFromDraft(draft, existingOverrides = [], now = Date.now()) {
  if (!draft.targetId) return null;
  const targetKey = `${draft.targetType}:${draft.targetId}`;
  const alreadyExists = existingOverrides.some((item) => {
    const target = overrideTarget(item);
    return `${target.type}:${target.id}` === targetKey;
  });
  if (alreadyExists) return null;

  const recurrenceInterval = Number(draft.recurrenceInterval || getDefaultRecurrenceInterval(draft.recurrenceType));
  if (isInvalidCustomInterval(draft.recurrenceType, recurrenceInterval)) return null;

  return {
    id: `draft-${now}`,
    assetId: draft.targetType === "asset" ? draft.targetId : null,
    segmentId: draft.targetType === "segment" ? draft.targetId : null,
    recurrenceType: draft.recurrenceType,
    recurrenceInterval,
    recurrenceIntervalDays: recurrenceInterval,
    preferredTime: draft.preferredTime || "08:00",
    active: true
  };
}

// Nome e cor identificam o plano na interface; ambos precisam ser unicos.
export function findDuplicateAutomationIdentity(plans, form) {
  const normalizedName = form.name.trim().toLocaleLowerCase("pt-BR");
  const normalizedColor = normalizeAutomationColor(form.indicatorColor).toLowerCase();
  const others = plans.filter((plan) => String(plan.id) !== String(form.id || ""));
  const duplicateNamePlan = others.find(
    (plan) =>
      String(plan.name || "")
        .trim()
        .toLocaleLowerCase("pt-BR") === normalizedName
  );
  const duplicateColorPlan = others.find((plan) => normalizeAutomationColor(plan.indicatorColor).toLowerCase() === normalizedColor);

  return {
    duplicateNamePlan,
    duplicateColorPlan,
    hasDuplicateAutomationIdentity: Boolean((normalizedName && duplicateNamePlan) || duplicateColorPlan)
  };
}

export function isColorUsedByOtherPlan(plans, formId, color) {
  return plans.some((plan) => String(plan.id) !== String(formId || "") && normalizeAutomationColor(plan.indicatorColor) === color);
}

// `sources` agrupa as listas de inventario: { devices, segments, segmentGroups, inventoryTabs }.
export function getScopeOptions(type, sources = {}) {
  const { devices = [], segments = [], segmentGroups = [], inventoryTabs = [] } = sources;
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

export function getScopeLabel(plan, sources) {
  if (plan.scopeType === "all") return preventiveAutomationScopeLabels.all;
  if (plan.scopeType === "asset_list") {
    const count = Array.isArray(plan.assetIds) ? plan.assetIds.length : 0;
    return `${preventiveAutomationScopeLabels.asset_list}: ${count} máquina(s)`;
  }
  const option = getScopeOptions(plan.scopeType, sources).find((item) => String(item.id) === String(plan.scopeId));
  return `${preventiveAutomationScopeLabels[plan.scopeType] || "Escopo"}: ${option?.label || plan.scopeId || "não informado"}`;
}

export function getRecurrenceLabel(plan) {
  const label = preventiveAutomationRecurrenceLabels[plan.recurrenceType] || plan.recurrenceType || "Mensal";
  return `${label} - a cada ${getPlanRecurrenceIntervalDays(plan)} dia(s)`;
}

export function getRecurrenceShortLabel(plan) {
  if (plan.recurrenceType === "custom_days") {
    return `A cada ${getPlanRecurrenceIntervalDays(plan)} dia(s)`;
  }
  return preventiveAutomationRecurrenceLabels[plan.recurrenceType] || "Mensal";
}

export function getOverrideLabel(item, sources) {
  const target = overrideTarget(item);
  const option = getScopeOptions(target.type, sources).find((scopeOption) => String(scopeOption.id) === String(target.id));
  const targetLabel = option?.label || target.id || "não informado";
  const targetName = target.type === "asset" ? "Máquina" : "Segmento";
  return `${targetName}: ${targetLabel} • ${getRecurrenceShortLabel(item)}`;
}
