export const CENTRAL_ASSET_TYPES = new Set(["server", "switch", "router", "nas"]);

export function resolveAssetType(device) {
  return device?.assetType || device?.type || "other";
}

export function isCentralAssetType(device) {
  return CENTRAL_ASSET_TYPES.has(resolveAssetType(device));
}

export function isAssetMissing(node, devicesById) {
  return !devicesById.has(node.assetId);
}

export function resolveNodeLabel(node, device) {
  return node.labelOverride || device?.name || "Ativo removido";
}

/**
 * O nome exibido (device.name) ja pode ser o apelido/nome fantasia do
 * ativo (decorado em App.jsx) - essa funcao devolve o nome tecnico/real so
 * quando ele difere do que ja esta sendo mostrado, pra nao duplicar texto
 * identico quando o ativo nao tem apelido.
 */
export function resolveNodeSecondaryName(node, device, label) {
  if (!device?.technicalName) return null;
  return device.technicalName !== label ? device.technicalName : null;
}

/**
 * Deriva o status de uma conexao a partir do status dos dois ativos que ela liga.
 * Nunca promete monitoramento real de link - e sempre uma leitura indireta do
 * status dos dois ativos, exceto quando o usuario define um status manual
 * (statusOverride), que sempre tem prioridade.
 */
export function deriveLinkStatus(link, devicesById) {
  if (link.statusOverride) return link.statusOverride;

  const source = devicesById.get(link.sourceAssetId);
  const target = devicesById.get(link.targetAssetId);
  if (!source || !target) return "unknown";

  if (source.status === "problem" || target.status === "problem") return "critical";
  if (source.status === "offline" || target.status === "offline") return "offline";
  if (source.status === "online" && target.status === "online") return "online";
  return "unknown";
}

const STATUS_COLOR_TOKENS = {
  online: "var(--topology-status-online)",
  warning: "var(--topology-status-warning)",
  critical: "var(--topology-status-critical)",
  offline: "var(--topology-status-critical)",
  manual: "var(--topology-status-manual)",
  unknown: "var(--topology-status-unknown)"
};

export function getStatusColorToken(status) {
  return STATUS_COLOR_TOKENS[status] || STATUS_COLOR_TOKENS.unknown;
}

const STATUS_LABELS = {
  online: "Online",
  warning: "Atenção",
  critical: "Crítico",
  offline: "Offline",
  manual: "Manual",
  unknown: "Sem dados"
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.unknown;
}

const DEVICE_STATUS_PULSE_TONES = {
  online: "ok",
  offline: "offline",
  problem: "danger"
};

export function resolveNodeStatusTone(device) {
  return DEVICE_STATUS_PULSE_TONES[device?.status] || "offline";
}

export function buildFilterPredicate({ search = "", status = "", segmentId = "", assetType = "" } = {}) {
  const normalizedSearch = search.trim().toLowerCase();

  return (device) => {
    if (!device) return false;
    if (status && device.status !== status) return false;
    if (segmentId && device.segmentId !== segmentId) return false;
    if (assetType && resolveAssetType(device) !== assetType) return false;
    if (normalizedSearch) {
      const haystack = `${device.name || ""} ${device.ip || ""}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }
    return true;
  };
}
