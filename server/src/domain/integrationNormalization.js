const ASSET_SOURCES = new Set(["agent", "manual", "mock", "ocs", "zabbix"]);
const ALERT_SEVERITIES = new Set(["info", "warning", "high", "critical"]);
const ALERT_STATUSES = new Set(["active", "resolved", "unknown"]);

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function text(value, fallback = null) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function number(value, fallback = null) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function timestamp(value, fallback = new Date().toISOString()) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function cleanRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeHostname(value) {
  return text(value)?.toLowerCase().replace(/\.$/, "") || null;
}

export function normalizeIp(value) {
  return text(value)?.toLowerCase() || null;
}

export function normalizeSerial(value) {
  return text(value)?.toUpperCase().replace(/\s+/g, "") || null;
}

export function normalizeMacAddress(value) {
  const compact = text(value)?.toUpperCase().replace(/[^0-9A-F]/g, "");
  if (!compact || compact.length !== 12) return text(value);
  return compact.match(/.{2}/g).join(":");
}

export function normalizeSource(value, fallback = "mock") {
  const normalized = text(value, fallback)?.toLowerCase();
  return ASSET_SOURCES.has(normalized) ? normalized : fallback;
}

function normalizeAssetStatus(value) {
  const normalized = text(value, "unknown").toLowerCase();
  if (["online", "up", "available", "enabled", "0"].includes(normalized)) return "online";
  if (["offline", "down", "unavailable", "disabled", "1"].includes(normalized)) return "offline";
  if (["problem", "warning", "degraded", "error"].includes(normalized)) return "problem";
  return "unknown";
}

function buildNormalizedAsset({
  source,
  externalId,
  hostname,
  displayName,
  ip,
  serialNumber,
  assetTag,
  macAddress,
  manufacturer,
  model,
  operatingSystem,
  status,
  metrics = {},
  hardware = {},
  collectedAt,
  rawData,
  includeRawData = false
}) {
  const normalizedSource = normalizeSource(source);
  const normalizedExternalId = text(externalId);
  if (!normalizedExternalId) {
    throw new TypeError(`Ativo ${normalizedSource} sem identificador externo.`);
  }

  return {
    source: normalizedSource,
    externalId: normalizedExternalId,
    hostname: normalizeHostname(hostname),
    displayName: text(displayName, text(hostname, normalizedExternalId)),
    ip: normalizeIp(ip),
    serialNumber: text(serialNumber),
    assetTag: text(assetTag),
    macAddress: normalizeMacAddress(macAddress),
    manufacturer: text(manufacturer),
    model: text(model),
    operatingSystem: text(operatingSystem),
    status: normalizeAssetStatus(status),
    metrics: cleanRecord(metrics),
    hardware: cleanRecord(hardware),
    collectedAt: timestamp(collectedAt),
    rawData: includeRawData ? cleanRecord(rawData) : null
  };
}

export function normalizeOcsAsset(rawAsset, options = {}) {
  const raw = cleanRecord(rawAsset);
  const hardware = cleanRecord(firstValue(raw.hardware, raw.bios, {}));
  const network = cleanRecord(firstValue(raw.network, raw.networks?.[0], {}));

  return buildNormalizedAsset({
    source: "ocs",
    externalId: firstValue(raw.externalId, raw.hostId, raw.id, raw.deviceid, raw.hardware_id),
    hostname: firstValue(raw.hostname, raw.name, raw.computerName, raw.NAME, raw.hostId),
    displayName: firstValue(raw.displayName, raw.name, raw.NAME, raw.hostname, raw.hostId),
    ip: firstValue(raw.ip, raw.localIp, raw.ipAddress, raw.IPADDRESS, network.ip, network.ipAddress),
    serialNumber: firstValue(raw.serialNumber, raw.serial, raw.SSN, hardware.serialNumber),
    assetTag: firstValue(raw.assetTag, raw.tag, raw.TAG),
    macAddress: firstValue(raw.macAddress, raw.mac, raw.MACADDR, network.mac, network.macAddress),
    manufacturer: firstValue(raw.manufacturer, raw.vendor, raw.MANUFACTURER, hardware.manufacturer),
    model: firstValue(raw.model, raw.MODEL, hardware.model),
    operatingSystem: firstValue(raw.operatingSystem, raw.os, raw.OSNAME, raw.osName),
    status: firstValue(raw.status, "online"),
    hardware: {
      cpuModel: firstValue(raw.cpuModel, raw.processor, hardware.cpuModel),
      cpuCores: number(firstValue(raw.cpuCores, raw.processors, hardware.cpuCores)),
      ramGb: number(firstValue(raw.ramGb, raw.memoryGb, hardware.ramGb)),
      disks: Array.isArray(raw.disks) ? raw.disks : [],
      software: Array.isArray(raw.software) ? raw.software : [],
      peripherals: Array.isArray(raw.peripherals) ? raw.peripherals : [],
      loggedUser: text(firstValue(raw.loggedUser, raw.user, raw.USERID))
    },
    collectedAt: firstValue(raw.collectedAt, raw.lastInventoryAt, raw.lastdate, raw.LASTDATE),
    rawData: raw,
    includeRawData: options.includeRawData
  });
}

function zabbixInterface(raw) {
  const interfaces = Array.isArray(raw.interfaces) ? raw.interfaces : [];
  return interfaces.find((item) => item.main === "1" || item.main === 1) || interfaces[0] || {};
}

export function normalizeZabbixHost(rawHost, options = {}) {
  const raw = cleanRecord(rawHost);
  const inventory = cleanRecord(raw.inventory);
  const iface = zabbixInterface(raw);

  return buildNormalizedAsset({
    source: "zabbix",
    externalId: firstValue(raw.externalId, raw.hostid, raw.id),
    hostname: firstValue(raw.host, raw.hostname, raw.name),
    displayName: firstValue(raw.name, raw.host, raw.hostname),
    ip: firstValue(raw.ip, iface.ip, iface.dns),
    serialNumber: firstValue(raw.serialNumber, inventory.serialno_a, inventory.serialno_b),
    assetTag: firstValue(raw.assetTag, inventory.asset_tag),
    macAddress: firstValue(raw.macAddress, inventory.macaddress_a, inventory.macaddress_b),
    manufacturer: firstValue(raw.manufacturer, inventory.vendor),
    model: firstValue(raw.model, inventory.model),
    operatingSystem: firstValue(raw.operatingSystem, inventory.os_full, inventory.os),
    status: firstValue(raw.statusLabel, raw.available, raw.status),
    metrics: raw.metrics,
    hardware: {
      uptimeHours: number(raw.uptimeHours),
      description: text(firstValue(raw.description, inventory.notes)),
      inventory
    },
    collectedAt: firstValue(raw.collectedAt, raw.lastSeenAt),
    rawData: raw,
    includeRawData: options.includeRawData
  });
}

function normalizeSeverity(value) {
  const normalized = text(value, "warning").toLowerCase();
  const zabbixSeverity = {
    "0": "info",
    "1": "info",
    "2": "warning",
    "3": "warning",
    "4": "high",
    "5": "critical",
    disaster: "critical",
    average: "warning"
  }[normalized];
  const candidate = zabbixSeverity || normalized;
  return ALERT_SEVERITIES.has(candidate) ? candidate : "warning";
}

function normalizeAlertStatus(value, resolvedAt) {
  if (resolvedAt) return "resolved";
  const normalized = text(value, "active").toLowerCase();
  if (["0", "resolved", "closed", "ok"].includes(normalized)) return "resolved";
  if (["1", "active", "open", "problem"].includes(normalized)) return "active";
  return ALERT_STATUSES.has(normalized) ? normalized : "unknown";
}

export function normalizeZabbixProblem(rawProblem, options = {}) {
  const raw = cleanRecord(rawProblem);
  const externalId = text(firstValue(raw.externalId, raw.eventid, raw.problemid, raw.id));
  if (!externalId) throw new TypeError("Problema Zabbix sem identificador externo.");
  const resolvedAt = firstValue(raw.resolvedAt, raw.r_clock ? Number(raw.r_clock) * 1000 : null);

  return {
    source: "zabbix",
    externalId,
    assetExternalId: text(firstValue(raw.assetExternalId, raw.hostid, raw.hostId)),
    assetHostname: normalizeHostname(firstValue(raw.assetHostname, raw.hostname, raw.hostName, raw.host)),
    name: text(firstValue(raw.name, raw.title, raw.description), `Problema ${externalId}`),
    severity: normalizeSeverity(firstValue(raw.severity, raw.priority)),
    status: normalizeAlertStatus(firstValue(raw.status, raw.value), resolvedAt),
    occurredAt: timestamp(firstValue(
      raw.occurredAt,
      raw.startedAt,
      raw.clock ? Number(raw.clock) * 1000 : null
    )),
    resolvedAt: resolvedAt ? timestamp(resolvedAt) : null,
    metadata: {
      ...cleanRecord(raw.metadata),
      description: text(raw.description),
      tags: Array.isArray(raw.tags) ? raw.tags : []
    },
    rawData: options.includeRawData ? raw : null
  };
}

function assetIdentity(asset) {
  return text(asset.id) || `${normalizeSource(asset.source)}:${text(asset.externalId, "")}`;
}

function uniqueAssets(items) {
  const byIdentity = new Map();
  for (const item of items) byIdentity.set(assetIdentity(item), item);
  return Array.from(byIdentity.values());
}

export function correlateNormalizedAsset(candidate, existingAssets = []) {
  const normalizedCandidate = {
    ...candidate,
    source: normalizeSource(candidate?.source),
    hostname: normalizeHostname(candidate?.hostname),
    ip: normalizeIp(candidate?.ip),
    serialNumber: normalizeSerial(candidate?.serialNumber)
  };
  const strategies = [
    {
      name: "source_external_id",
      value: text(normalizedCandidate.externalId),
      matches: (asset) =>
        normalizeSource(asset.source) === normalizedCandidate.source &&
        text(asset.externalId) === text(normalizedCandidate.externalId)
    },
    {
      name: "hostname",
      value: normalizedCandidate.hostname,
      matches: (asset) => normalizeHostname(asset.hostname) === normalizedCandidate.hostname
    },
    {
      name: "ip",
      value: normalizedCandidate.ip,
      matches: (asset) => normalizeIp(asset.ip) === normalizedCandidate.ip
    },
    {
      name: "serial_number",
      value: normalizedCandidate.serialNumber,
      matches: (asset) => normalizeSerial(asset.serialNumber) === normalizedCandidate.serialNumber
    }
  ];

  const evidence = strategies
    .filter((strategy) => strategy.value)
    .map((strategy) => ({
      strategy: strategy.name,
      matches: uniqueAssets(existingAssets.filter(strategy.matches))
    }))
    .filter((item) => item.matches.length);
  const candidates = uniqueAssets(evidence.flatMap((item) => item.matches));
  const ambiguousEvidence = evidence.some((item) => item.matches.length > 1);

  if (ambiguousEvidence || candidates.length > 1) {
    return {
      match: null,
      strategy: null,
      conflict: true,
      candidates,
      evidence: evidence.map((item) => ({
        strategy: item.strategy,
        candidateIds: item.matches.map(assetIdentity)
      }))
    };
  }

  const match = candidates[0] || null;
  const strategy = match
    ? evidence.find((item) => item.matches.some((asset) => assetIdentity(asset) === assetIdentity(match)))?.strategy
    : null;

  return {
    match,
    strategy,
    conflict: false,
    candidates,
    evidence: evidence.map((item) => ({
      strategy: item.strategy,
      candidateIds: item.matches.map(assetIdentity)
    }))
  };
}

export const supportedAssetSources = Object.freeze(Array.from(ASSET_SOURCES));
