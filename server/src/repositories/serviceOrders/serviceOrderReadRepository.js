import { query } from "../../database.js";
import { canViewServiceOrder } from "../../domain/serviceOrders/serviceOrderAccess.js";
import { withDisplayPriority } from "../../domain/serviceOrders/serviceOrderSla.js";
import { listServiceOrderFeedbackByOrderIds } from "./serviceOrderFeedbackRepository.js";
import { listServiceOrderHistory } from "./serviceOrderHistoryRepository.js";
import { listServiceOrderItems, listServiceOrderItemsByOrderIds } from "./serviceOrderItemRepository.js";
import { fromHistoryRow, fromOrderRow } from "./serviceOrderMappers.js";
import { getServiceOrderSettings } from "./serviceOrderSettingsRepository.js";

export async function listServiceOrders(user = null) {
  const settings = await getServiceOrderSettings();
  const result = await query(`
    SELECT *
    FROM service_orders
    ORDER BY created_at DESC
  `);

  const historyResult = await query(`
    SELECT *
    FROM service_order_history
    ORDER BY created_at DESC
  `);
  const historyByOrder = new Map();

  for (const event of historyResult.rows.map(fromHistoryRow)) {
    const current = historyByOrder.get(event.serviceOrderId) || [];
    current.push(event);
    historyByOrder.set(event.serviceOrderId, current);
  }

  const orderIds = result.rows.map((row) => row.id);
  const itemsByOrder = await listServiceOrderItemsByOrderIds(orderIds);
  const feedbackByOrder = await listServiceOrderFeedbackByOrderIds(orderIds);

  const rows = result.rows.map((row) => withDisplayPriority(row, settings));

  return rows
    .map((row) => fromOrderRow(
      row,
      historyByOrder.get(row.id) || [],
      itemsByOrder.get(row.id) || [],
      settings,
      feedbackByOrder.get(row.id) || null
    ))
    .filter((order) => !user || canViewServiceOrder(user, order));
}

export async function listServiceOrdersByAssetId(assetId, { limit = 50 } = {}) {
  const settings = await getServiceOrderSettings();
  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE asset_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [assetId, limit]
  );

  const orderIds = result.rows.map((row) => row.id);
  const itemsByOrder = await listServiceOrderItemsByOrderIds(orderIds);
  const feedbackByOrder = await listServiceOrderFeedbackByOrderIds(orderIds);
  const rows = result.rows.map((row) => withDisplayPriority(row, settings));

  return rows.map((row) =>
    fromOrderRow(row, [], itemsByOrder.get(row.id) || [], settings, feedbackByOrder.get(row.id) || null)
  );
}

export async function findServiceOrderById(id, user = null) {
  const settings = await getServiceOrderSettings();
  const result = await query("SELECT * FROM service_orders WHERE id = $1", [id]);
  const row = result.rows[0] ? withDisplayPriority(result.rows[0], settings) : null;
  if (!row) return null;

  const history = await listServiceOrderHistory(id);
  const items = await listServiceOrderItems(id);
  const order = fromOrderRow(row, history, items, settings);
  if (user && !canViewServiceOrder(user, order)) return null;
  return order;
}
