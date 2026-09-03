import { createHash } from "node:crypto";

function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function text(...values) { return values.find((value) => String(value ?? "").trim())?.toString().trim() || null; }
function stableKey(assetId, type, item, index) {
  const identity = text(item.serialNumber, item.serial, item.macAddress, item.mac, item.partNumber, item.deviceId, item.pnpDeviceId, item.name, item.model, index);
  return createHash("sha256").update(`${assetId}|${type}|${identity}`).digest("hex").slice(0, 32);
}

function descriptor(asset, type, category, item, index, fallbackName) {
  const name = text(item.name, item.label, item.model, item.product, item.description, fallbackName);
  if (!name) return null;
  return {
    sourceAssetId: asset.asset_id,
    hardwareKey: stableKey(asset.asset_id, type, item, index),
    name,
    category,
    brand: text(item.manufacturer, item.brand, item.vendor),
    model: text(item.model, item.product),
    manufacturerPartNumber: text(item.partNumber, item.sku),
    serialNumber: text(item.serialNumber, item.serial),
    macAddress: text(item.macAddress, item.mac),
    metadata: { hardwareType: type, collectedValue: item }
  };
}

export function collectHardwareParts(asset) {
  const details = object(asset.inventory_details);
  const parts = [];
  const add = (type, category, item, index, fallback) => {
    const value = descriptor(asset, type, category, object(item), index, fallback);
    if (value) parts.push(value);
  };
  const cpu = object(details.cpu);
  const motherboard = object(details.motherboard);
  if (asset.cpu_model || Object.keys(cpu).length) add("cpu", "Processador", cpu, 0, asset.cpu_model);
  if (Object.keys(motherboard).length) add("motherboard", "Placa-mãe", motherboard, 0, null);
  array(details.memoryHealth?.moduleDetails || details.memoryModules).forEach((item, index) => add("memory", "Memória", item, index, `Módulo de memória ${index + 1}`));
  array(details.disks).forEach((item, index) => add("disk", "Armazenamento", item, index, `Disco ${index + 1}`));
  array(details.graphics).forEach((item, index) => add("graphics", "Vídeo", item, index, `Adaptador de vídeo ${index + 1}`));
  array(details.networkAdapters).forEach((item, index) => add("network", "Rede", item, index, `Adaptador de rede ${index + 1}`));
  array(details.peripherals).forEach((item, index) => add("peripheral", "Periféricos", item, index, `Periférico ${index + 1}`));
  return parts;
}
