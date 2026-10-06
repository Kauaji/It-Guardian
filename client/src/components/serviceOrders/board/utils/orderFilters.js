import {
  generalSector,
  getServiceOrderOriginKey,
  isServiceOrderVisibleInMonth,
  normalizeSearchText,
  orderBelongsToClient,
  orderBelongsToSector
} from "../../serviceOrderBoardUtils.js";

// Filtros puros do quadro de OS: mes, setor, catalogo (selects) e pesquisa livre.

export function getTechnicianNames(order) {
  return order.assignedTechnicianNames || [order.assignedTechnicianName];
}

export function filterByMonth(orders, monthFilter, finalStatusIds) {
  return monthFilter
    ? orders.filter((order) => isServiceOrderVisibleInMonth(order, monthFilter, finalStatusIds))
    : orders;
}

/** "Meu setor": do setor do usuario, do Geral, atribuida ao usuario ou criada por ele. */
export function isOrderMine(order, user) {
  return Boolean(
    (user?.sectorId && orderBelongsToSector(order, user.sectorId)) ||
    orderBelongsToSector(order, generalSector.id) ||
    getTechnicianNames(order).includes(user?.name) ||
    order.createdBy === user?.id
  );
}

export function filterBySector(orders, { sectorFilter, canViewAllSectors, user }) {
  if (sectorFilter === "all" && canViewAllSectors) return orders;
  if (sectorFilter === "mine") return orders.filter((order) => isOrderMine(order, user));
  return orders.filter((order) => orderBelongsToSector(order, sectorFilter || generalSector.id));
}

export function filterByCatalog(orders, filters) {
  const { businessMode, clientFilter, priorityFilter, technicianFilter, statusFilter, slaFilter, originFilter, ratingFilter } = filters;
  let result = orders;

  if (businessMode && clientFilter !== "all") {
    result = result.filter((order) => orderBelongsToClient(order, clientFilter));
  }

  if (priorityFilter !== "all") {
    result = result.filter((order) => order.priority === priorityFilter);
  }

  if (technicianFilter !== "all") {
    const technician = normalizeSearchText(technicianFilter);
    result = result.filter((order) => getTechnicianNames(order).some((name) => normalizeSearchText(name) === technician));
  }

  if (statusFilter !== "all") {
    result = result.filter((order) => order.status === statusFilter);
  }

  if (slaFilter !== "all") {
    result = result.filter((order) => (order.sla?.status || "not_applicable") === slaFilter);
  }

  if (originFilter !== "all") {
    result = result.filter((order) => getServiceOrderOriginKey(order) === originFilter);
  }

  if (ratingFilter !== "all") {
    result = result.filter((order) =>
      ratingFilter === "none"
        ? !order.feedback?.rating
        : order.feedback?.rating === Number(ratingFilter)
    );
  }

  return result;
}

export function filterBySearch(orders, search, assetById) {
  const term = normalizeSearchText(search);
  if (!term) return orders;

  return orders.filter((order) => {
    const asset = assetById.get(order.assetId);
    const searchable = [
      order.number,
      order.title,
      order.description,
      order.category,
      order.status,
      order.priority,
      order.requesterName,
      order.assignedTechnicianName,
      ...(order.assignedTechnicianNames || []),
      order.environmentName,
      order.sectorName,
      order.serviceCode,
      order.serviceName,
      order.servicePerformed,
      asset?.name,
      asset?.hostname,
      asset?.ip
    ];

    return searchable.some((value) => normalizeSearchText(value).includes(term));
  });
}
