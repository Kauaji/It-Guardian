import {
  findIntegrationAsset,
  listIntegrationAssets
} from "../repositories/integrationRepository.js";

function correlatedZabbixAsset(asset, assets) {
  const matchedId = asset.correlation?.matchedIntegrationAssetId;
  const directMatch = matchedId
    ? assets.find((candidate) => candidate.id === matchedId && candidate.source === "zabbix")
    : null;
  if (directMatch) return directMatch;

  return assets.find(
    (candidate) =>
      candidate.source === "zabbix" &&
      candidate.correlation?.matchedIntegrationAssetId === asset.id
  ) || null;
}

function toLegacyInventory(asset, assets) {
  const correlatedHost = correlatedZabbixAsset(asset, assets);
  return {
    hostId: correlatedHost?.externalId || asset.externalId,
    integrationAssetId: asset.id,
    externalId: asset.externalId,
    source: "ocs",
    displayName: asset.displayName || asset.hostname || asset.externalId,
    hostname: asset.hostname,
    ip: asset.ip,
    status: asset.status,
    manufacturer: asset.manufacturer,
    model: asset.model,
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber,
    loggedUser: asset.hardware?.loggedUser || null,
    macAddress: asset.macAddress,
    os: asset.operatingSystem,
    cpuModel: asset.hardware?.cpuModel || null,
    cpuCores: asset.hardware?.cpuCores ?? null,
    ramGb: asset.hardware?.ramGb ?? null,
    disks: asset.hardware?.disks || [],
    peripherals: asset.hardware?.peripherals || [],
    software: asset.hardware?.software || [],
    lastInventoryAt: asset.collectedAt,
    collectedAt: asset.collectedAt,
    sourceConflicts: asset.correlation?.conflict
      ? [{ source: "ocs", externalId: asset.externalId }]
      : []
  };
}

export async function getInventory() {
  const assets = await listIntegrationAssets();
  return assets
    .filter((asset) => asset.source === "ocs")
    .map((asset) => toLegacyInventory(asset, assets));
}

export async function getInventoryByHostId(hostId) {
  const directAsset = await findIntegrationAsset("ocs", hostId);
  if (directAsset) {
    const assets = await listIntegrationAssets();
    return toLegacyInventory(directAsset, assets);
  }

  const inventory = await getInventory();
  return inventory.find((item) => String(item.hostId) === String(hostId)) || null;
}
