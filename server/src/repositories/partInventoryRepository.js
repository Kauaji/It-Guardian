import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { collectHardwareParts } from "../domain/hardwarePartInventory.js";

function missing() { const error = new Error("Peça não encontrada."); error.statusCode = 404; return error; }
function mapPart(row) { return { id: row.id, name: row.name, category: row.category, brand: row.brand, model: row.model, internalCode: row.internal_code, assetTag: row.asset_tag, manufacturerPartNumber: row.manufacturer_part_number, serialNumber: row.serial_number, macAddress: row.mac_address, location: row.location, quantity: Number(row.quantity || 0), minimumStock: Number(row.minimum_stock || 0), unitPrice: Number(row.unit_price || 0), unit: row.unit, notes: row.notes, conditionStatus: row.condition_status, assignedAssetId: row.assigned_asset_id, inventoryState: row.inventory_state || "available", source: row.source || "manual", sourceAssetId: row.source_asset_id, hardwareKey: row.hardware_key, supplierName: row.supplier_name, supplierTaxId: row.supplier_tax_id, supplierProductCode: row.supplier_product_code, lastVerifiedAt: row.last_verified_at, discrepancyStatus: row.discrepancy_status || "ok", discrepancyDetails: row.discrepancy_details || {}, active: row.active, stockStatus: Number(row.quantity || 0) <= 0 ? "out" : Number(row.quantity || 0) <= Number(row.minimum_stock || 0) ? "low" : "ok", createdAt: row.created_at, updatedAt: row.updated_at }; }
function mapMovement(row) { return { id: row.id, partId: row.part_id, movementType: row.movement_type, quantity: Number(row.quantity), previousQuantity: Number(row.previous_quantity), resultingQuantity: Number(row.resulting_quantity), serviceOrderId: row.service_order_id, serviceOrderNumber: row.service_order_number, assetId: row.asset_id, notes: row.notes, performedBy: row.performed_by, performedByName: row.performed_by_name, createdAt: row.created_at }; }

export async function listParts({ search = "", stockStatus = "", inventoryState = "", discrepancyStatus = "", assignedAssetId = "" } = {}) {
  const params = [];
  const where = ["p.active = TRUE"];
  if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.internal_code ILIKE $${params.length} OR p.serial_number ILIKE $${params.length} OR p.mac_address ILIKE $${params.length} OR p.manufacturer_part_number ILIKE $${params.length})`); }
  if (stockStatus === "out") where.push("p.quantity <= 0");
  if (stockStatus === "low") where.push("p.quantity > 0 AND p.quantity <= p.minimum_stock");
  if (stockStatus === "ok") where.push("p.quantity > p.minimum_stock");
  if (["available", "in_use"].includes(inventoryState)) { params.push(inventoryState); where.push(`p.inventory_state = $${params.length}`); }
  if (discrepancyStatus === "open") where.push("p.discrepancy_status <> 'ok'");
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

export async function listPartCategories() {
  const result = await query("SELECT * FROM part_categories WHERE active=TRUE ORDER BY name");
  return result.rows.map((row) => ({ id: row.id, name: row.name, color: row.color, active: row.active }));
}

export async function createPartCategory({ name, color }, user) {
  try {
    const result = await query(
      "INSERT INTO part_categories (id,name,color,created_by) VALUES ($1,$2,$3,$4) RETURNING *",
      [randomUUID(), name, color || "#475569", user.id]
    );
    return { id: result.rows[0].id, name: result.rows[0].name, color: result.rows[0].color, active: true };
  } catch (error) {
    if (error.code === "23505") { error.statusCode = 409; error.message = "Esta categoria já existe."; }
    throw error;
  }
}

export async function deletePartCategory(id) {
  const result = await query("UPDATE part_categories SET active=FALSE, updated_at=NOW() WHERE id=$1 AND active=TRUE RETURNING id", [id]);
  if (!result.rowCount) { const error = new Error("Categoria não encontrada."); error.statusCode = 404; throw error; }
}

function partFingerprint(part) {
  return JSON.stringify([part.name, part.brand, part.model, part.manufacturerPartNumber, part.serialNumber, part.macAddress]);
}

export async function syncAgentHardwareParts(user) {
  const assets = await query("SELECT asset_id, hostname, machine_alias, cpu_model, inventory_details FROM agent_assets ORDER BY asset_id");
  return withTransaction(async (db) => {
    let created = 0;
    let updated = 0;
    let discrepancies = 0;
    const observed = new Map();
    for (const asset of assets.rows) {
      const keys = new Set();
      observed.set(asset.asset_id, keys);
      for (const hardware of collectHardwareParts(asset)) {
        keys.add(hardware.hardwareKey);
        const currentResult = await db("SELECT * FROM products WHERE source_asset_id=$1 AND hardware_key=$2 FOR UPDATE", [asset.asset_id, hardware.hardwareKey]);
        if (!currentResult.rowCount) {
          const id = randomUUID();
          await db(`INSERT INTO products (id,name,category,brand,model,internal_code,manufacturer_part_number,serial_number,mac_address,location,quantity,minimum_stock,unit_price,unit,notes,condition_status,assigned_asset_id,active,metadata_json,inventory_state,source,source_asset_id,hardware_key,last_verified_at,discrepancy_status,discrepancy_details)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,0,0,'un',$11,'used',$12,TRUE,$13::jsonb,'in_use','agent',$12,$14,NOW(),'ok','{}'::jsonb)`,
          [id,hardware.name,hardware.category,hardware.brand,hardware.model,`HW-${hardware.hardwareKey.slice(0,12).toUpperCase()}`,hardware.manufacturerPartNumber,hardware.serialNumber,hardware.macAddress,asset.machine_alias||asset.hostname,"Componente coletado automaticamente pelo agente.",asset.asset_id,JSON.stringify(hardware.metadata),hardware.hardwareKey]);
          await db(`INSERT INTO part_inventory_movements (id,part_id,movement_type,quantity,previous_quantity,resulting_quantity,asset_id,notes,performed_by) VALUES ($1,$2,'assignment',1,0,1,$3,$4,$5)`, [randomUUID(),id,asset.asset_id,"Componente identificado pelo inventário do agente",user.id]);
          created += 1;
          continue;
        }
        const current = mapPart(currentResult.rows[0]);
        const changed = partFingerprint(current) !== partFingerprint(hardware);
        const discrepancyStatus = changed ? "unverified_change" : current.discrepancyStatus === "missing" ? "ok" : current.discrepancyStatus;
        if (changed) discrepancies += 1;
        await db(`UPDATE products SET name=$2,category=$3,brand=$4,model=$5,manufacturer_part_number=$6,serial_number=$7,mac_address=$8,assigned_asset_id=$9,quantity=1,inventory_state='in_use',last_verified_at=NOW(),discrepancy_status=$10,discrepancy_details=$11::jsonb,metadata_json=$12::jsonb,active=TRUE,updated_at=NOW() WHERE id=$1`,
          [current.id,hardware.name,hardware.category,hardware.brand,hardware.model,hardware.manufacturerPartNumber,hardware.serialNumber,hardware.macAddress,asset.asset_id,discrepancyStatus,JSON.stringify(changed?{previous:partFingerprint(current),detectedAt:new Date().toISOString()}:{}),JSON.stringify(hardware.metadata)]);
        updated += 1;
      }
    }
    const tracked = await db("SELECT id, source_asset_id, hardware_key FROM products WHERE source='agent' AND active=TRUE");
    for (const item of tracked.rows) {
      if (!observed.get(item.source_asset_id)?.has(item.hardware_key)) {
        await db("UPDATE products SET discrepancy_status='missing', discrepancy_details=$2::jsonb, updated_at=NOW() WHERE id=$1", [item.id, JSON.stringify({ detectedAt: new Date().toISOString(), reason: "Componente não foi localizado na coleta atual." })]);
        discrepancies += 1;
      }
    }
    return { assets: assets.rowCount, created, updated, discrepancies };
  });
}

export async function importPartInvoice(invoice, user) {
  return withTransaction(async (db) => {
    if (invoice.invoiceKey) {
      const duplicate = await db("SELECT id FROM part_inventory_imports WHERE invoice_key=$1", [invoice.invoiceKey]);
      if (duplicate.rowCount) { const error = new Error("Esta NF-e já foi importada."); error.statusCode = 409; throw error; }
    }
    let created = 0;
    let merged = 0;
    for (const item of invoice.items) {
      const match = await db(`SELECT * FROM products WHERE active=TRUE AND inventory_state='available' AND lower(COALESCE(supplier_name,''))=lower($1) AND lower(COALESCE(supplier_product_code,''))=lower($2) ORDER BY created_at LIMIT 1 FOR UPDATE`, [invoice.supplierName,item.supplierProductCode||item.name]);
      let partId;
      let previous = 0;
      if (match.rowCount) {
        partId = match.rows[0].id;
        previous = Number(match.rows[0].quantity || 0);
        await db("UPDATE products SET quantity=quantity+$2, unit_price=$3, updated_at=NOW() WHERE id=$1", [partId,item.quantity,item.unitPrice]);
        merged += 1;
      } else {
        partId = randomUUID();
        await db(`INSERT INTO products (id,name,category,internal_code,manufacturer_part_number,quantity,minimum_stock,unit_price,unit,notes,condition_status,active,metadata_json,inventory_state,source,supplier_name,supplier_tax_id,supplier_product_code,last_verified_at)
          VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,'new',TRUE,$10::jsonb,'available','invoice',$11,$12,$13,NOW())`,
        [partId,item.name,item.category,`NF-${partId.slice(0,8).toUpperCase()}`,item.manufacturerPartNumber,item.quantity,item.unitPrice,item.unit,`Importado da NF-e ${invoice.invoiceKey||"sem chave"}.`,JSON.stringify({ncm:item.ncm}),invoice.supplierName,invoice.supplierTaxId,item.supplierProductCode||item.name]);
        created += 1;
      }
      await db(`INSERT INTO part_inventory_movements (id,part_id,movement_type,quantity,previous_quantity,resulting_quantity,notes,performed_by) VALUES ($1,$2,'receipt',$3,$4,$5,$6,$7)`, [randomUUID(),partId,item.quantity,previous,previous+item.quantity,`Entrada via NF-e · ${invoice.supplierName}`,user.id]);
    }
    await db("INSERT INTO part_inventory_imports (id,invoice_key,supplier_name,supplier_tax_id,item_count,total_quantity,imported_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [randomUUID(),invoice.invoiceKey,invoice.supplierName,invoice.supplierTaxId,invoice.items.length,invoice.items.reduce((sum,item)=>sum+item.quantity,0),user.id]);
    return { invoiceKey: invoice.invoiceKey, supplierName: invoice.supplierName, itemCount: invoice.items.length, created, merged };
  });
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
