import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { normalizeServiceOrderItems } from "../../domain/serviceOrders/serviceOrderItems.js";
import { fromItemRow } from "./serviceOrderMappers.js";

export async function listServiceOrderItems(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM service_order_items
      WHERE service_order_id = $1
      ORDER BY created_at ASC
    `,
    [serviceOrderId]
  );

  return result.rows.map(fromItemRow);
}

export async function listServiceOrderItemsByOrderIds(orderIds = []) {
  const ids = orderIds.filter(Boolean);
  const itemsByOrder = new Map();
  if (!ids.length) return itemsByOrder;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `
      SELECT *
      FROM service_order_items
      WHERE service_order_id IN (${placeholders})
      ORDER BY created_at ASC
    `,
    ids
  );

  for (const row of result.rows.map(fromItemRow)) {
    const current = itemsByOrder.get(row.serviceOrderId) || [];
    current.push(row);
    itemsByOrder.set(row.serviceOrderId, current);
  }

  return itemsByOrder;
}

export async function replaceServiceOrderItems(serviceOrderId, items = [], db = query) {
  await db("DELETE FROM service_order_items WHERE service_order_id = $1", [serviceOrderId]);

  for (const item of normalizeServiceOrderItems(items)) {
    await db(
      `
        INSERT INTO service_order_items (
          id, service_order_id, product_id, product_name, quantity, unit_price, subtotal, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        item.id || randomUUID(),
        serviceOrderId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        item.notes || null
      ]
    );
  }
}
