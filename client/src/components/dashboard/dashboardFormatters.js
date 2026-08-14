export function metricClass(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

export function statusClass(status) {
  return {
    online: "ok",
    offline: "warning",
    problem: "danger"
  }[status];
}

const healthToneByClassification = {
  healthy: "ok",
  attention: "warning",
  critical: "danger",
  emergency: "danger"
};

export function healthClassificationTone(classification) {
  return healthToneByClassification[classification] || "warning";
}

export function formatCount(value) {
  return Number.isFinite(value) ? value : "--";
}

export function formatPercent(value, digits = 0) {
  return Number.isFinite(value) ? `${value.toFixed(digits)}%` : "--";
}

export function formatShortDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

export function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const periodLabels = {
  today: "Hoje",
  "7d": "7 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  "90d": "90 dias"
};

export function periodLabel(period) {
  return periodLabels[period] || period;
}
