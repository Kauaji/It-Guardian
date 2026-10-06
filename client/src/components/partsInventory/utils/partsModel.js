// Constantes e regras puras do inventario de pecas (sem React).
export const EMPTY_PART = {
  name: "",
  category: "",
  brand: "",
  model: "",
  internalCode: "",
  manufacturerPartNumber: "",
  serialNumber: "",
  macAddress: "",
  location: "",
  quantity: 0,
  minimumStock: 0,
  unitPrice: 0,
  unit: "un",
  conditionStatus: "new",
  notes: "",
  active: true
};

export const EMPTY_MOVEMENT = { movementType: "consumption", quantity: 1, assetId: "", serviceOrderId: "", notes: "" };

export const MOVEMENT_LABELS = {
  receipt: "Entrada",
  consumption: "Consumo",
  return: "Retorno",
  adjustment: "Ajuste de saldo",
  assignment: "Designação",
  unassignment: "Desvinculação"
};

export const INVENTORY_LABELS = { available: "Disponível", in_use: "Em uso" };

const CORE_HARDWARE_TYPES = new Set(["cpu", "motherboard", "memory", "disk", "graphics", "power_supply"]);

export function isHardwareDiscrepancy(part) {
  return part.discrepancyStatus !== "ok" && CORE_HARDWARE_TYPES.has(part.metadata?.hardwareType);
}

export function readableSnapshot(snapshot) {
  if (!snapshot) return "Não informado";
  if (typeof snapshot === "string") {
    try {
      return readableSnapshot(JSON.parse(snapshot));
    } catch {
      return snapshot;
    }
  }
  if (Array.isArray(snapshot)) return snapshot.filter(Boolean).join(" · ") || "Não informado";
  return (
    [
      snapshot.name,
      snapshot.brand,
      snapshot.model,
      snapshot.manufacturerPartNumber,
      snapshot.serialNumber,
      snapshot.capacityGb ? `${snapshot.capacityGb} GB` : null
    ]
      .filter(Boolean)
      .join(" · ") || "Não informado"
  );
}

// Legenda do saldo no cartao: peca instalada aponta para o kit; peca em estoque mostra a situacao do saldo.
export function stockCaption(part, discrepancy) {
  if (part.inventoryState === "in_use") return discrepancy ? "Revisar" : "Ver kit";
  if (part.stockStatus === "out") return "Sem estoque";
  if (part.stockStatus === "low") return "Reposição necessária";
  return "Disponível";
}

export function summarizeParts(parts) {
  return {
    catalog: parts.length,
    available: parts.filter((item) => item.inventoryState === "available").reduce((sum, item) => sum + item.quantity, 0),
    inUse: parts.filter((item) => item.inventoryState === "in_use").length,
    discrepancies: parts.filter(isHardwareDiscrepancy).length
  };
}

export function buildPartsQuery({ search, inventoryState, discrepancyOnly }) {
  return { search, inventoryState, ...(discrepancyOnly ? { discrepancyStatus: "open" } : {}) };
}

export function assetDisplayName(devices, id) {
  const device = devices.find((item) => item.id === id);
  return device?.alias || device?.hostname || id;
}

export function isOpenServiceOrder(order) {
  return !order.closedAt && order.status !== "closed";
}

export function isCreditMovement(movementType) {
  return ["receipt", "return"].includes(movementType);
}

// Uma peca instalada (e sem divergencia) nao abre o inspetor: leva ao kit da maquina.
export function installedAssetId(part) {
  const assetId = part.assignedAssetId || part.sourceAssetId;
  return part.inventoryState === "in_use" && assetId && !isHardwareDiscrepancy(part) ? assetId : "";
}

export function numberOrText(target) {
  return target.type === "number" ? Number(target.value) : target.value;
}
