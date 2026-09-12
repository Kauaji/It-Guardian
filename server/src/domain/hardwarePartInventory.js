import { createHash } from "node:crypto";

function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function text(...values) { return values.find((value) => String(value ?? "").trim())?.toString().trim() || null; }
function normalized(value = "") { return String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(); }
function hardwareIdentity(item = {}) {
  return normalized([item.name, item.label, item.model, item.product, item.description, item.manufacturer, item.brand, item.vendor, item.type, item.pnpClass, item.deviceId, item.pnpDeviceId, item.id].filter(Boolean).join(" "));
}
function isSyntheticHardware(item) {
  const identity = hardwareIdentity(item);
  return /\bvirtual\b|parsec|remote display|indirect display|adaptador de exibicao indireto|mirage|spacedesk|citrix|hyper-v|virtualbox|vmware virtual|vbox|qemu|microsoft basic (display|render)|standard vga|adaptador grafico basico|\bdriver\b|software device|dispositivo de software|root\\|swd\\/.test(identity);
}
function isPhysicalGraphicsAdapter(item) {
  const identity = hardwareIdentity(item);
  if (!identity || isSyntheticHardware(item)) return false;
  // O Windows também publica a GPU integrada ao processador como um adaptador.
  // O inventário patrimonial deve listar somente placas discretas substituíveis.
  if (/radeon\(tm\) graphics|radeon graphics|intel.*(?:uhd|iris|\bhd\b).*graphics|vega \d+ graphics/.test(identity)) return false;
  return /nvidia|geforce|quadro|tesla|radeon (?:rx|pro)|firepro|intel arc [ab]\d|matrox|aspeed/.test(identity);
}
function isPhysicalStorage(item) {
  const identity = hardwareIdentity(item);
  return Boolean(identity) && !isSyntheticHardware(item) && !/storage space|espaco de armazenamento|virtual disk|disco virtual/.test(identity);
}
function peripheralType(item = {}) {
  const explicit = normalized(item.type || item.pnpClass);
  const identity = hardwareIdentity(item);
  if (/mouse/.test(explicit) || /\bmouse\b/.test(identity)) return "mouse";
  if (/keyboard|teclado/.test(explicit) || /keyboard|teclado/.test(identity)) return "keyboard";
  if (/monitor/.test(explicit) || /\bmonitor\b/.test(identity)) return "monitor";
  if (/printer|impressora|scanner|camera|image|webcam|headset|headphone|fone|dock/.test(explicit) || /printer|impressora|scanner|camera|webcam|headset|headphone|fone|dock/.test(identity)) return "misc";
  return "";
}
function isPhysicalPeripheral(item) {
  const identity = hardwareIdentity(item);
  if (!peripheralType(item) || isSyntheticHardware(item)) return false;
  return !/hid-compliant|compativel com hid|dispositivo hid|hid keyboard device|dispositivo de teclado hid|hid mouse device|dispositivo de mouse hid|usb input device|dispositivo de entrada usb|standard ps\/2|padrao ps\/2|generic (?:non-)?pnp monitor|monitor (?:nao )?pnp generico|dispositivo de controle do consumidor|audio gateway service|servico de gateway de audio|camera dfu|firmware update/.test(identity);
}
function peripheralIdentity(item = {}) {
  const type = peripheralType(item);
  const serial = text(item.serialNumber, item.serial, item.macAddress, item.mac);
  if (serial) return `${type}|${normalized(serial)}`;
  const deviceId = normalized(text(item.deviceId, item.pnpDeviceId, item.id) || "").replace(/&mi_[0-9a-f]{2}.*/, "");
  const vidPid = deviceId.match(/vid_[0-9a-f]{4}.*pid_[0-9a-f]{4}/)?.[0];
  return [type, normalized(text(item.name, item.model, item.product)), normalized(text(item.manufacturer, item.brand, item.vendor)), vidPid].filter(Boolean).join("|");
}
function uniquePhysicalPeripherals(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!isPhysicalPeripheral(item)) return false;
    const identity = peripheralIdentity(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
function memoryModuleName(item, index) {
  const capacity = Number(item.capacityGb);
  if (Number.isFinite(capacity) && capacity > 0) return `${capacity.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `Módulo de memória ${index + 1}`;
}
function stableKey(assetId, type, item, index) {
  const deviceIdentity = ["mouse", "keyboard", "monitor", "peripheral"].includes(type)
    ? text(item.deviceId, item.pnpDeviceId, item.id)
    : null;
  const identity = text(item.serialNumber, item.serial, item.macAddress, item.mac, item.partNumber, deviceIdentity, item.name, item.model, index);
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
    metadata: { hardwareType: type, collectionIndex: index, collectedValue: item }
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
  array(details.memoryHealth?.moduleDetails || details.memoryModules).forEach((item, index) => add("memory", "Memória", item, index, memoryModuleName(item, index)));
  array(details.disks).filter(isPhysicalStorage).forEach((item, index) => add("disk", "Armazenamento", item, index, `Disco ${index + 1}`));
  array(details.graphics).filter(isPhysicalGraphicsAdapter).forEach((item, index) => add("graphics", "Placa de vídeo", item, index, `Placa de vídeo ${index + 1}`));
  const powerSupply = object(details.powerSupply || details.psu);
  if (Object.keys(powerSupply).length) add("power_supply", "Fonte", powerSupply, 0, "Fonte de alimentação");
  uniquePhysicalPeripherals(array(details.peripherals)).forEach((item, index) => {
    const type = peripheralType(item);
    if (type === "mouse") add("mouse", "Mouse", item, index, `Mouse ${index + 1}`);
    else if (type === "keyboard") add("keyboard", "Teclado", item, index, `Teclado ${index + 1}`);
    else if (type === "monitor") add("monitor", "Monitor", item, index, `Monitor ${index + 1}`);
    else add("peripheral", "Diversos", item, index, `Periférico ${index + 1}`);
  });
  return parts;
}

export function isSupportedPhysicalPartRecord(part = {}) {
  const metadata = object(part.metadata || part.metadata_json);
  const type = normalized(metadata.hardwareType);
  const collected = { ...object(metadata.collectedValue), name: part.name || metadata.collectedValue?.name, category: part.category };
  if (type === "network") return false;
  if (type === "graphics") return isPhysicalGraphicsAdapter(collected);
  if (type === "disk") return isPhysicalStorage(collected);
  if (["mouse", "keyboard", "monitor", "peripheral"].includes(type)) return isPhysicalPeripheral({ ...collected, type });
  return ["cpu", "motherboard", "memory", "power_supply"].includes(type) || !isSyntheticHardware(collected);
}

export function isCoreHardwarePartRecord(part = {}) {
  const metadata = object(part.metadata || part.metadata_json);
  return ["cpu", "motherboard", "memory", "disk", "graphics", "power_supply"].includes(normalized(metadata.hardwareType));
}
