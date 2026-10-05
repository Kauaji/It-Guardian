import { randomUUID } from "node:crypto";

export function toMoneyValue(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).replace(/[^\d,.-]/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100) / 100;
}

export function toQuantityValue(value) {
  const quantity = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.round(quantity * 100) / 100;
}

export function normalizeServiceOrderItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const quantity = toQuantityValue(item.quantity);
      const unitPrice = toMoneyValue(item.unitPrice ?? item.unit_price);
      return {
        id: item.id || randomUUID(),
        productId: item.productId || item.product_id || null,
        productName: String(item.productName || item.product_name || item.name || "").trim(),
        quantity,
        unitPrice,
        subtotal: Math.round(quantity * unitPrice * 100) / 100,
        notes: String(item.notes || "").trim()
      };
    })
    .filter((item) => item.productName);
}

export function sumServiceOrderItems(items = []) {
  return Math.round(items.reduce((total, item) => total + toMoneyValue(item.subtotal), 0) * 100) / 100;
}

export function itemsSignature(items = []) {
  return JSON.stringify(
    normalizeServiceOrderItems(items).map((item) => ({
      productId: item.productId || "",
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      notes: item.notes || ""
    }))
  );
}

export function formatItemsForHistory(items = []) {
  const normalized = normalizeServiceOrderItems(items);
  if (!normalized.length) return "";
  return normalized
    .map((item) => `${item.productName} x${item.quantity} - R$ ${item.subtotal.toFixed(2).replace(".", ",")}`)
    .join("\n");
}
