import { formatCurrency, normalizeQuantity, parseCurrency } from "./money.js";

// Itens (pecas/produtos) e rascunho de atendimento da OS.

export function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const quantity = normalizeQuantity(item.quantity);
      const unitPrice = parseCurrency(item.unitPrice ?? item.unit_price);
      return {
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: item.productId || item.product_id || "",
        productName: item.productName || item.product_name || item.name || "",
        quantity,
        unitPrice,
        subtotal: Math.round(quantity * unitPrice * 100) / 100,
        notes: item.notes || ""
      };
    })
    .filter((item) => item.productName);
}

export function sumItems(items) {
  return items.reduce((total, item) => total + Number(item.subtotal || 0), 0);
}

/** Rascunho editavel do atendimento a partir da OS (vazio quando nao ha OS). */
export function buildDraft(serviceOrder) {
  return {
    title: serviceOrder?.title || "",
    priority: serviceOrder?.priority || "medium",
    assignedTechnicianName: serviceOrder?.assignedTechnicianName || "",
    autoPriorityEnabled: serviceOrder?.autoPriorityEnabled ?? false,
    workNotes: serviceOrder?.workNotes || "",
    diagnosis: serviceOrder?.diagnosis || "",
    solution: serviceOrder?.solution || "",
    servicePerformed: serviceOrder?.servicePerformed || "",
    attendanceNotes: serviceOrder?.attendanceNotes || "",
    partsUsed: serviceOrder?.partsUsed || "",
    serviceValue: String(serviceOrder?.serviceValue ?? 0),
    items: normalizeItems(serviceOrder?.items || serviceOrder?.serviceItems || [])
  };
}

export const emptyPartDraft = { productId: "", quantity: 1, unitPrice: "0" };

/** Linha de texto acrescentada a "pecas usadas" ao adicionar uma peca. */
export function buildPartLine({ productName, quantity, unitPrice, subtotal }) {
  return unitPrice
    ? `${productName} x${quantity} - ${formatCurrency(subtotal)}`
    : `${productName} x${quantity}`;
}

/** Nova peca a partir do produto do catalogo (ou nome digitado) e do rascunho da peca. */
export function buildPartItem({ product, manualProductName, partDraft }) {
  const quantity = normalizeQuantity(partDraft.quantity);
  const unitPrice = parseCurrency(partDraft.unitPrice);
  const subtotal = Math.round(quantity * unitPrice * 100) / 100;
  const productName = product?.name || manualProductName;
  return {
    id: `${product?.id || "manual"}-${Date.now()}`,
    productId: product?.id || "",
    productName,
    quantity,
    unitPrice,
    subtotal,
    notes: ""
  };
}

/** Rascunho apos adicionar uma peca (texto livre e lista de itens). */
export function appendPart(draft, item) {
  return {
    ...draft,
    partsUsed: [draft.partsUsed, buildPartLine(item)].filter(Boolean).join("\n"),
    items: [...normalizeItems(draft.items), item]
  };
}
