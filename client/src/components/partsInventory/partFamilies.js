const FAMILY_DEFINITIONS = [
  { id: "motherboard", label: "Placas-mãe", color: "#7c3aed" },
  { id: "processor", label: "Processadores", color: "#0891b2" },
  { id: "graphics", label: "Placas de vídeo", color: "#db2777" },
  { id: "memory", label: "Memórias", color: "#2563eb" },
  { id: "storage", label: "HD, SSD e NVMe", color: "#0f766e" },
  { id: "power", label: "Fontes", color: "#d97706" },
  { id: "mouse", label: "Mouses", color: "#9333ea" },
  { id: "keyboard", label: "Teclados", color: "#0284c7" },
  { id: "monitor", label: "Monitores", color: "#059669" },
  { id: "misc", label: "Diversos", color: "#64748b" }
];

export const PART_FAMILIES = Object.fromEntries(FAMILY_DEFINITIONS.map((item) => [item.id, item]));

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

export function resolvePartFamily(part = {}) {
  const category = normalize(part.category);
  const identity = normalize(`${part.category || ""} ${part.name || ""} ${part.model || ""}`);

  if (category.includes("placa-mae") || /motherboard|mainboard/.test(identity)) return PART_FAMILIES.motherboard;
  if (category.includes("processador") || /processor|\bcpu\b|ryzen|core i[3579]/.test(identity)) return PART_FAMILIES.processor;
  if (category.includes("placa de video") || category === "video" || /geforce|radeon|graphics/.test(identity)) return PART_FAMILIES.graphics;
  if (category.includes("memoria") || /\bram\b|ddr[345]/.test(identity)) return PART_FAMILIES.memory;
  if (category.includes("armazenamento") || /\bssd\b|\bnvme\b|hard disk|disco|\bhdd\b/.test(identity)) return PART_FAMILIES.storage;
  if (category.includes("fonte") || /power supply|\bpsu\b|fonte/.test(identity)) return PART_FAMILIES.power;
  if (category.includes("mouse") || /\bmouse\b/.test(identity)) return PART_FAMILIES.mouse;
  if (category.includes("teclado") || /keyboard|teclado/.test(identity)) return PART_FAMILIES.keyboard;
  if (category.includes("monitor") || /\bmonitor\b/.test(identity)) return PART_FAMILIES.monitor;
  return PART_FAMILIES.misc;
}

export function groupPartsByFamily(parts = []) {
  const groups = new Map();
  for (const part of parts) {
    const family = resolvePartFamily(part);
    groups.set(family.id, { ...family, parts: [...(groups.get(family.id)?.parts || []), part] });
  }
  return FAMILY_DEFINITIONS.map((family) => groups.get(family.id)).filter(Boolean);
}

export function buildComputerKits(parts = [], devices = []) {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const kits = new Map();

  for (const part of parts.filter((item) => item.inventoryState === "in_use" && (item.assignedAssetId || item.sourceAssetId))) {
    const assetId = part.assignedAssetId || part.sourceAssetId;
    if (!kits.has(assetId)) {
      const device = deviceById.get(assetId);
      kits.set(assetId, {
        assetId,
        name: device?.alias || device?.hostname || device?.name || "Máquina não localizada",
        segmentName: device?.segmentName || "Sem segmento",
        parts: []
      });
    }
    kits.get(assetId).parts.push(part);
  }

  return [...kits.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
