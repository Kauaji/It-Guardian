/**
 * Funcoes puras de status agregado e montagem da hierarquia Grupo -> Segmento
 * -> Ativo do Mapa de Rede. Nao inventa dado: status sempre deriva do que ja
 * esta em `device.status`; sem ativos ou sem status reconhecido cai em
 * "sem_dados", nunca num valor "bonito" inventado.
 */

const STATUS_ORDER = ["critico", "atencao", "misto", "online", "sem_dados"];

export function computeSegmentStatus(devices = []) {
  if (!devices.length) return "sem_dados";
  if (devices.some((device) => device?.status === "problem")) return "critico";
  if (devices.some((device) => device?.status === "offline")) return "atencao";
  if (devices.every((device) => device?.status === "online")) return "online";
  return "sem_dados";
}

function computeContainerStatus(childStatuses = []) {
  if (!childStatuses.length) return "sem_dados";
  const unique = new Set(childStatuses);
  if (unique.size === 1) return childStatuses[0];
  if (unique.has("critico")) return "critico";
  return "misto";
}

export function computeGroupStatus(segmentStatuses = []) {
  return computeContainerStatus(segmentStatuses);
}

export function computeTabStatus(groupStatuses = []) {
  return computeContainerStatus(groupStatuses);
}

export function compareStatusSeverity(a, b) {
  return STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b);
}

const AGGREGATE_STATUS_LABELS = {
  critico: "Crítico",
  atencao: "Atenção",
  online: "Online",
  misto: "Misto",
  sem_dados: "Sem dados"
};

const AGGREGATE_STATUS_COLOR_TOKENS = {
  critico: "var(--topology-status-critical)",
  atencao: "var(--topology-status-warning)",
  online: "var(--topology-status-online)",
  misto: "var(--topology-status-manual)",
  sem_dados: "var(--topology-status-unknown)"
};

export function getAggregateStatusLabel(status) {
  return AGGREGATE_STATUS_LABELS[status] || AGGREGATE_STATUS_LABELS.sem_dados;
}

export function getAggregateStatusColorToken(status) {
  return AGGREGATE_STATUS_COLOR_TOKENS[status] || AGGREGATE_STATUS_COLOR_TOKENS.sem_dados;
}

/**
 * Map segmentId -> ativos daquele segmento, a partir da lista plana de
 * dispositivos ja decorados (device.segmentId ja existe hoje em
 * App.jsx/InventoryBoard.jsx).
 */
export function groupDevicesBySegment(devices = []) {
  const bySegment = new Map();
  for (const device of devices) {
    const segmentId = device?.segmentId;
    if (!segmentId) continue;
    if (!bySegment.has(segmentId)) bySegment.set(segmentId, []);
    bySegment.get(segmentId).push(device);
  }
  return bySegment;
}

/**
 * Resumo de um segmento: contagem e status agregado a partir dos ativos
 * reais que pertencem a ele (device_segments no backend, ja resolvido em
 * device.segmentId no cliente).
 */
export function summarizeSegment(segment, devicesBySegment) {
  const devices = devicesBySegment.get(segment.id) || [];
  return {
    ...segment,
    deviceCount: devices.length,
    onlineCount: devices.filter((device) => device?.status === "online").length,
    offlineCount: devices.filter((device) => device?.status === "offline").length,
    criticalCount: devices.filter((device) => device?.status === "problem").length,
    status: computeSegmentStatus(devices)
  };
}

/**
 * Resumo de um grupo: seus segmentos reais (inventory_segments.group_id),
 * com status agregado a partir do status de cada segmento.
 */
export function summarizeGroup(group, segments, devicesBySegment) {
  const groupSegments = segments
    .filter((segment) => (segment.groupId || "") === group.id)
    .map((segment) => summarizeSegment(segment, devicesBySegment));
  const deviceCount = groupSegments.reduce((total, segment) => total + segment.deviceCount, 0);
  return {
    ...group,
    segments: groupSegments,
    segmentCount: groupSegments.length,
    deviceCount,
    status: computeGroupStatus(groupSegments.map((segment) => segment.status))
  };
}

/**
 * Monta a arvore completa Grupo -> Segmento -> Ativo para a aba/filtro
 * atual. `groups`/`segments`/`devices` devem chegar ja filtrados pelo nivel
 * de cima (aba ativa) - esta funcao so faz o aninhamento pelas relacoes
 * reais do banco (group_id, segmentId), sem repetir logica de filtro de aba.
 */
export function buildHierarchyTree({ groups = [], segments = [], devices = [] }) {
  const devicesBySegment = groupDevicesBySegment(devices);
  const groupSummaries = groups.map((group) => summarizeGroup(group, segments, devicesBySegment));
  const ungroupedSegments = segments
    .filter((segment) => !segment.groupId)
    .map((segment) => summarizeSegment(segment, devicesBySegment));

  return {
    groups: groupSummaries,
    ungroupedSegments,
    tabStatus: computeTabStatus([
      ...groupSummaries.map((group) => group.status),
      ...ungroupedSegments.map((segment) => segment.status)
    ]),
    groupCount: groupSummaries.length,
    segmentCount: groupSummaries.reduce((total, group) => total + group.segmentCount, 0) + ungroupedSegments.length,
    deviceCount: groupSummaries.reduce((total, group) => total + group.deviceCount, 0)
      + ungroupedSegments.reduce((total, segment) => total + segment.deviceCount, 0)
  };
}
