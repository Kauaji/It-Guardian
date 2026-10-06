import { hasPermission } from "../../permissions.js";
import { isGeneralSector } from "./serviceOrderSector.js";
import { normalizeText } from "./serviceOrderText.js";

/** @import { ServiceOrder, ServiceOrderUser } from "./types.js" */

/**
 * @param {ServiceOrderUser} [user]
 * @returns {boolean}
 */
export function canViewAllServiceOrders(user = {}) {
  return hasPermission(user, "service_orders.view_all") || hasPermission(user, "admin.full");
}

/**
 * @param {ServiceOrderUser | null | undefined} [user]
 * @param {Partial<ServiceOrder>} [order]
 * @returns {boolean}
 */
export function canViewServiceOrder(user = {}, order = {}) {
  if (!user?.id) return false;
  if (canViewAllServiceOrders(user)) return true;
  if (Array.isArray(user.allowedClientIds) && user.allowedClientIds.length && order.environmentId) {
    return user.allowedClientIds.includes(order.environmentId);
  }
  if (isGeneralSector(order)) return true;
  if (order.createdBy && order.createdBy === user.id) return true;
  if (order.sectorId && user.sectorId && order.sectorId === user.sectorId) return true;
  if (normalizeText(order.sectorName) && normalizeText(order.sectorName) === normalizeText(user.sectorName)) return true;
  const assignedNames = order.assignedTechnicianNames?.length
    ? order.assignedTechnicianNames
    : order.assignedTechnicianName
      ? [order.assignedTechnicianName]
      : [];
  if (assignedNames.some((name) => normalizeText(name) === normalizeText(user.name) || normalizeText(name) === normalizeText(user.email))) {
    return true;
  }
  return false;
}
