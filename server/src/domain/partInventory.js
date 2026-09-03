const CONDITIONS = new Set(["new", "used", "refurbished", "damaged"]);
const MOVEMENTS = new Set(["receipt", "consumption", "return", "adjustment", "assignment", "unassignment"]);

function invalid(message) { const error = new Error(message); error.statusCode = 400; throw error; }
function text(value) { return String(value ?? "").trim(); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export function validatePart(payload = {}, { partial = false } = {}) {
  const result = {};
  if (!partial || Object.hasOwn(payload, "name")) { result.name = text(payload.name); if (result.name.length < 2) invalid("Informe o nome da peça."); }
  const textFields = ["category", "brand", "model", "internalCode", "assetTag", "manufacturerPartNumber", "serialNumber", "macAddress", "location", "unit", "notes", "assignedAssetId"];
  for (const field of textFields) if (!partial || Object.hasOwn(payload, field)) result[field] = text(payload[field]) || null;
  if (!partial || Object.hasOwn(payload, "quantity")) { result.quantity = number(payload.quantity); if (result.quantity < 0) invalid("A quantidade não pode ser negativa."); }
  if (!partial || Object.hasOwn(payload, "minimumStock")) { result.minimumStock = number(payload.minimumStock); if (result.minimumStock < 0) invalid("O estoque mínimo não pode ser negativo."); }
  if (!partial || Object.hasOwn(payload, "unitPrice")) { result.unitPrice = number(payload.unitPrice); if (result.unitPrice < 0) invalid("O valor unitário não pode ser negativo."); }
  if (!partial || Object.hasOwn(payload, "conditionStatus")) { result.conditionStatus = payload.conditionStatus || "new"; if (!CONDITIONS.has(result.conditionStatus)) invalid("Condição da peça inválida."); }
  if (!partial || Object.hasOwn(payload, "active")) result.active = payload.active !== false;
  return result;
}

export function validatePartMovement(payload = {}) {
  const movementType = text(payload.movementType);
  if (!MOVEMENTS.has(movementType)) invalid("Tipo de movimentação inválido.");
  const quantity = number(payload.quantity);
  if (quantity <= 0) invalid("A quantidade movimentada deve ser maior que zero.");
  if (["consumption", "assignment"].includes(movementType) && !text(payload.assetId) && !text(payload.serviceOrderId)) invalid("Vincule o consumo a um ativo ou Ordem de Serviço.");
  return { movementType, quantity, assetId: text(payload.assetId) || null, serviceOrderId: text(payload.serviceOrderId) || null, notes: text(payload.notes).slice(0, 1000) || null };
}

export function validatePartCategory(payload = {}) {
  const name = text(payload.name);
  if (name.length < 2 || name.length > 80) invalid("Informe um nome de categoria válido.");
  const color = text(payload.color) || "#475569";
  if (!/^#[0-9a-f]{6}$/i.test(color)) invalid("Informe uma cor hexadecimal válida.");
  return { name, color };
}
