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

const NODE_DIMENSIONS = {
  asset: { width: 116, height: 100 },
  segment: { width: 148, height: 118 },
  group: { width: 148, height: 118 }
};

export function getNodeDimensions(node) {
  return NODE_DIMENSIONS[node?.nodeType] || NODE_DIMENSIONS.asset;
}

export function isClusterNode(node) {
  return node?.nodeType === "segment" || node?.nodeType === "group";
}

const ENTITY_MISSING_LABELS = {
  asset: "Ativo removido",
  segment: "Segmento removido",
  group: "Grupo removido"
};

// Rotulo generico pro inspector de conexao - funciona pra ativo (entity =
// device) ou cluster (entity = resumo de segmento/grupo), sem assumir forma
// de dispositivo.
export function resolveEntityLabel(nodeType, entity) {
  return entity?.name || ENTITY_MISSING_LABELS[nodeType] || ENTITY_MISSING_LABELS.asset;
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

// Status agregado (networkTopologyHierarchy.js) -> vocabulario de status de
// link, so pra dar uma cor com sentido a uma conexao entre clusters -
// statusOverride sempre vence, entao isso e so uma sugestao visual.
const AGGREGATE_TO_LINK_STATUS = {
  critico: "critical",
  atencao: "warning",
  online: "online",
  misto: "warning",
  sem_dados: "unknown"
};

/**
 * Deriva o status de uma conexao a partir do status dos dois lados que ela
 * liga. Nunca promete monitoramento real de link - e sempre uma leitura
 * indireta do status dos dois lados, exceto quando o usuario define um
 * status manual (statusOverride), que sempre tem prioridade.
 * `clusterSummaryByRefId` (opcional) resolve o status quando o link liga
 * dois nos de cluster (segmento/grupo) em vez de dois ativos.
 */
export function deriveLinkStatus(link, devicesById, clusterSummaryByRefId) {
  if (link.statusOverride) return link.statusOverride;

  if (link.sourceType && link.sourceType !== "asset") {
    const source = clusterSummaryByRefId?.get(link.sourceAssetId);
    const target = clusterSummaryByRefId?.get(link.targetAssetId);
    if (!source || !target) return "unknown";
    const worst = [source.status, target.status]
      .map((status) => AGGREGATE_TO_LINK_STATUS[status] || "unknown")
      .sort((a, b) => LINK_STATUS_SEVERITY.indexOf(a) - LINK_STATUS_SEVERITY.indexOf(b));
    return worst[0];
  }

  const source = devicesById.get(link.sourceAssetId);
  const target = devicesById.get(link.targetAssetId);
  if (!source || !target) return "unknown";

  if (source.status === "problem" || target.status === "problem") return "critical";
  if (source.status === "offline" || target.status === "offline") return "offline";
  if (source.status === "online" && target.status === "online") return "online";
  return "unknown";
}

const LINK_STATUS_SEVERITY = ["critical", "offline", "warning", "online", "unknown"];

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
