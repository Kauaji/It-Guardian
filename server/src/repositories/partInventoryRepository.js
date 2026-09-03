import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";

function missing() { const error = new Error("Peça não encontrada."); error.statusCode = 404; return error; }
function mapPart(row) { return { id: row.id, name: row.name, category: row.category, brand: row.brand, model: row.model, internalCode: row.internal_code, assetTag: row.asset_tag, manufacturerPartNumber: row.manufacturer_part_number, serialNumber: row.serial_number, macAddress: row.mac_address, location: row.location, quantity: Number(row.quantity || 0), minimumStock: Number(row.minimum_stock || 0), unitPrice: Number(row.unit_price || 0), unit: row.unit, notes: row.notes, conditionStatus: row.condition_status, assignedAssetId: row.assigned_asset_id, active: row.active, stockStatus: Number(row.quantity || 0) <= 0 ? "out" : Number(row.quantity || 0) <= Number(row.minimum_stock || 0) ? "low" : "ok", createdAt: row.created_at, updatedAt: row.updated_at }; }
function mapMovement(row) { return { id: row.id, partId: row.part_id, movementType: row.movement_type, quantity: Number(row.quantity), previousQuantity: Number(row.previous_quantity), resultingQuantity: Number(row.resulting_quantity), serviceOrderId: row.service_order_id, serviceOrderNumber: row.service_order_number, assetId: row.asset_id, notes: row.notes, performedBy: row.performed_by, performedByName: row.performed_by_name, createdAt: row.created_at }; }

export async function listParts({ search = "", stockStatus = "", assignedAssetId = "" } = {}) {
  const params = [];
  const where = ["p.active = TRUE"];
  if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.internal_code ILIKE $${params.length} OR p.serial_number ILIKE $${params.length} OR p.mac_address ILIKE $${params.length} OR p.manufacturer_part_number ILIKE $${params.length})`); }
  if (stockStatus === "out") where.push("p.quantity <= 0");
  if (stockStatus === "low") where.push("p.quantity > 0 AND p.quantity <= p.minimum_stock");
  if (stockStatus === "ok") where.push("p.quantity > p.minimum_stock");
  if (assignedAssetId) { params.push(assignedAssetId); where.push(`p.assigned_asset_id = $${params.length}`); }
  const result = await query(`SELECT p.* FROM products p WHERE ${where.join(" AND ")} ORDER BY p.name`, params);
  return result.rows.map(mapPart);
}

export async function getPart(id) {
  const result = await query("SELECT * FROM products WHERE id=$1", [id]);
  if (!result.rowCount) throw missing();
  const movements = await query(`SELECT m.*, so.number service_order_number, u.name performed_by_name FROM part_inventory_movements m LEFT JOIN service_orders so ON so.id=m.service_order_id LEFT JOIN users u ON u.id=m.performed_by WHERE m.part_id=$1 ORDER BY m.created_at DESC`, [id]);
  return { ...mapPart(result.rows[0]), movements: movements.rows.map(mapMovement) };
}

export async function createPart(payload, user) {
  const id = randomUUID();
  await withTransaction(async (db) => {
    await db(`INSERT INTO products (id,name,category,brand,model,internal_code,asset_tag,manufacturer_part_number,serial_number,mac_address,location,quantity,minimum_stock,unit_price,unit,notes,condition_status,assigned_asset_id,active,metadata_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'{}'::jsonb)`, [id,payload.name,payload.category,payload.brand,payload.model,payload.internalCode,payload.assetTag,payload.manufacturerPartNumber,payload.serialNumber,payload.macAddress,payload.location,payload.quantity,payload.minimumStock,payload.unitPrice,payload.unit||"un",payload.notes,payload.conditionStatus,payload.assignedAssetId,payload.active]);
    if (payload.quantity > 0) await db(`INSERT INTO part_inventory_movements (id,part_id,movement_type,quantity,previous_quantity,resulting_quantity,notes,performed_by) VALUES ($1,$2,'receipt',$3,0,$3,$4,$5)`, [randomUUID(),id,payload.quantity,"Estoque inicial",user.id]);
  });
  return getPart(id);
}

export async function updatePart(id, payload) {
  const current = await getPart(id);
  const next = { ...current, ...payload };
  const result = await query(`UPDATE products SET name=$2,category=$3,brand=$4,model=$5,internal_code=$6,asset_tag=$7,manufacturer_part_number=$8,serial_number=$9,mac_address=$10,location=$11,minimum_stock=$12,unit_price=$13,unit=$14,notes=$15,condition_status=$16,assigned_asset_id=$17,active=$18,updated_at=NOW() WHERE id=$1 RETURNING id`, [id,next.name,next.category,next.brand,next.model,next.internalCode,next.assetTag,next.manufacturerPartNumber,next.serialNumber,next.macAddress,next.location,next.minimumStock,next.unitPrice,next.unit||"un",next.notes,next.conditionStatus,next.assignedAssetId,next.active]);
  if (!result.rowCount) throw missing();
  return getPart(id);
}

export async function movePart(id, movement, user) {
  await withTransaction(async (db) => {
    const currentResult = await db("SELECT quantity FROM products WHERE id=$1 FOR UPDATE", [id]);
    if (!currentResult.rowCount) throw missing();
    const previous = Number(currentResult.rows[0].quantity || 0);
    const inbound = ["receipt", "return"].includes(movement.movementType);
    const resulting = movement.movementType === "adjustment" ? movement.quantity : previous + (inbound ? movement.quantity : -movement.quantity);
    if (resulting < 0) { const error = new Error("Estoque insuficiente para esta movimentação."); error.statusCode = 409; throw error; }
    await db("UPDATE products SET quantity=$2, assigned_asset_id=CASE WHEN $3 IN ('assignment','consumption') AND $4 IS NOT NULL THEN $4 WHEN $3='unassignment' THEN NULL ELSE assigned_asset_id END, updated_at=NOW() WHERE id=$1", [id,resulting,movement.movementType,movement.assetId]);
    await db(`INSERT INTO part_inventory_movements (id,part_id,movement_type,quantity,previous_quantity,resulting_quantity,service_order_id,asset_id,notes,performed_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [randomUUID(),id,movement.movementType,movement.quantity,previous,resulting,movement.serviceOrderId,movement.assetId,movement.notes,user.id]);
  });
  return getPart(id);
}
