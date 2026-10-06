import { useEffect, useMemo, useState } from "react";
import { getCurrentBrowserMonth } from "../../serviceOrderBoardUtils.js";
import { filterByCatalog, filterByMonth, filterBySearch, filterBySector } from "../utils/orderFilters.js";

// Filtros do quadro (mes, setor, selects e pesquisa) e a lista de OS visiveis resultante.
export function useServiceOrderFilters({
  serviceOrders,
  assetById,
  finalStatusIds,
  businessMode,
  canViewAllSectors,
  canViewAllClients,
  user
}) {
  const [monthFilter, setMonthFilter] = useState(getCurrentBrowserMonth);
  const [orderSearch, setOrderSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    if (canViewAllSectors) return;
    setSectorFilter((current) => (current === "all" ? "mine" : current));
  }, [canViewAllSectors]);

  useEffect(() => {
    if (businessMode && canViewAllClients) return;
    setClientFilter("all");
  }, [businessMode, canViewAllClients]);

  const monthFilteredServiceOrders = useMemo(
    () => filterByMonth(serviceOrders, monthFilter, finalStatusIds),
    [finalStatusIds, serviceOrders, monthFilter]
  );
  const sectorFilteredServiceOrders = useMemo(
    () => filterBySector(monthFilteredServiceOrders, { sectorFilter, canViewAllSectors, user }),
    [canViewAllSectors, monthFilteredServiceOrders, sectorFilter, user?.id, user?.name, user?.sectorId]
  );
  const catalogFilteredServiceOrders = useMemo(
    () => filterByCatalog(sectorFilteredServiceOrders, {
      businessMode, clientFilter, priorityFilter, technicianFilter, statusFilter, slaFilter, originFilter, ratingFilter
    }),
    [
      businessMode,
      clientFilter,
      originFilter,
      priorityFilter,
      ratingFilter,
      sectorFilteredServiceOrders,
      slaFilter,
      statusFilter,
      technicianFilter
    ]
  );
  const visibleServiceOrders = useMemo(
    () => filterBySearch(catalogFilteredServiceOrders, orderSearch, assetById),
    [assetById, catalogFilteredServiceOrders, orderSearch]
  );

  return {
    monthFilter,
    setMonthFilter,
    orderSearch,
    setOrderSearch,
    filters: { sectorFilter, clientFilter, priorityFilter, technicianFilter, statusFilter, slaFilter, originFilter, ratingFilter },
    setters: {
      setSectorFilter,
      setClientFilter,
      setPriorityFilter,
      setTechnicianFilter,
      setStatusFilter,
      setSlaFilter,
      setOriginFilter,
      setRatingFilter
    },
    visibleServiceOrders
  };
}
