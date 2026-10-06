const pingTimeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function statusLabel(status) {
  return {
    online: "Online",
    offline: "Offline",
    problem: "Erro",
    unknown: "Sem dados"
  }[status] || "Sem dados";
}

export function statusTone(status) {
  return {
    online: "online",
    offline: "unknown",
    problem: "error"
  }[status] || "unknown";
}

export function pulseTone(status) {
  return {
    online: "ok",
    offline: "offline",
    problem: "danger"
  }[status] || "offline";
}

export function metricTone(value) {
  if (value >= 85) return "danger";
  if (value >= 70) return "warning";
  return "ok";
}

export function formatLastPing(lastPingAt) {
  return lastPingAt ? pingTimeFormatter.format(new Date(lastPingAt)) : "--:--";
}

// Classes CSS do cartao, na ordem original (inclui espacos duplicados).
export function buildMachineCardClassName({ isBackup, backupInUse, selected, expanded, moveMenuOpen, isDragging, isOverlay }) {
  return `machine-card ${isBackup ? "backup-card" : ""} ${backupInUse ? "backup-in-use" : ""} ${selected ? "selected" : ""} ${expanded ? "details-open" : ""} ${moveMenuOpen ? "move-menu-open" : ""} ${isDragging ? "dragging" : ""} ${isOverlay ? "drag-overlay" : ""}`;
}
