// Formatacao e leitura de valores monetarios e quantidades (pt-BR, BRL).

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export function formatCurrency(value) {
  return moneyFormatter.format(Number(value || 0));
}

export function parseCurrency(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).replace(/[^\d,.-]/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

export function normalizeQuantity(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 1;
}

export function getProductPrice(product) {
  return parseCurrency(product?.unitPrice ?? product?.unit_price ?? product?.price ?? product?.salePrice ?? 0);
}
