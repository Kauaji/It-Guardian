export const automationRecurrenceTypes = ["daily", "weekly", "biweekly", "monthly", "custom_days"];
export const automationTimezoneOptions = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "UTC"];

function normalizedInterval(source = {}) {
  return Number(source.recurrenceIntervalDays || source.recurrenceInterval || 30);
}

export function buildAutomationPlanDraft(plan = {}) {
  const source = plan || {};
  return {
    name: source.name || "",
    description: source.description || "",
    notes: source.notes || "",
    active: source.active !== false,
    recurrenceType: source.recurrenceType || "monthly",
    recurrenceIntervalDays: normalizedInterval(source),
    preferredTime: source.preferredTime || "08:00",
    timezone: source.timezone || "America/Sao_Paulo",
    indicatorColor: source.indicatorColor || "#1f7a61",
    defaultScriptIds: Array.isArray(source.defaultScriptIds) ? [...source.defaultScriptIds] : []
  };
}

export function buildAutomationOverrideDraft({ override, schedule, plan } = {}) {
  const activeOverride = override?.active === false ? null : override;
  const source = activeOverride || schedule || plan || {};

  return {
    recurrenceType: source.recurrenceType || "monthly",
    recurrenceIntervalDays: normalizedInterval(source),
    preferredTime: source.preferredTime || plan?.preferredTime || "08:00",
    active: activeOverride ? activeOverride.active !== false : true
  };
}

function validTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return false;
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function validateRecurrence(draft, errors) {
  if (!automationRecurrenceTypes.includes(draft.recurrenceType)) {
    errors.recurrenceType = "Selecione uma recorrência válida.";
  }
  if (
    draft.recurrenceType === "custom_days" &&
    (!Number.isInteger(Number(draft.recurrenceIntervalDays)) ||
      Number(draft.recurrenceIntervalDays) < 1 ||
      Number(draft.recurrenceIntervalDays) > 365)
  ) {
    errors.recurrenceIntervalDays = "Informe um intervalo entre 1 e 365 dias.";
  }
  if (!validTime(draft.preferredTime)) {
    errors.preferredTime = "Informe um horário válido.";
  }
}

export function validateAutomationPlanDraft(draft = {}) {
  const errors = {};
  if (String(draft.name || "").trim().length < 3) {
    errors.name = "O nome precisa ter pelo menos 3 caracteres.";
  }
  if (!Array.isArray(draft.defaultScriptIds) || !draft.defaultScriptIds.length) {
    errors.defaultScriptIds = "Selecione pelo menos um script.";
  }
  validateRecurrence(draft, errors);
  if (!/^#[0-9a-f]{6}$/i.test(String(draft.indicatorColor || ""))) {
    errors.indicatorColor = "Informe uma cor hexadecimal válida.";
  }
  if (!automationTimezoneOptions.includes(draft.timezone)) {
    errors.timezone = "Selecione um fuso horário permitido.";
  }
  return errors;
}

export function validateAutomationOverrideDraft(draft = {}) {
  const errors = {};
  validateRecurrence(draft, errors);
  return errors;
}

function normalizeComparable(value) {
  if (Array.isArray(value)) return [...value].map(String).sort();
  return value;
}

export function automationDraftsEqual(left = {}, right = {}) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => (
    JSON.stringify(normalizeComparable(left[key])) === JSON.stringify(normalizeComparable(right[key]))
  ));
}
