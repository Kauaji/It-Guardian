import { useEffect, useMemo, useState } from "react";
import { buildFilterPredicate } from "../networkTopologyModel.js";
import { DEFAULT_FILTERS } from "./topologyViewConstants.js";

export default function useTopologyFilters({ viewLevel, selectedSegmentId }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // No nivel Segmento o filtro de segmento fica implicito (o mapa ja e so
  // daquele segmento) - a Toolbar recebe lockSegmentFilter pra so esconder
  // o controle, reaproveitando o mesmo filters.segmentId/buildFilterPredicate.
  useEffect(() => {
    if (viewLevel === "segment" && selectedSegmentId) {
      setFilters((current) => (current.segmentId === selectedSegmentId ? current : { ...current, segmentId: selectedSegmentId }));
    }
  }, [viewLevel, selectedSegmentId]);

  // Niveis de cluster (Aba/Grupo) escondem os filtros na Toolbar - reseta
  // pra nao herdar um filtro de segmento/status deixado no nivel Segmento e
  // esconder sem querer os nos-cluster (visibleNodes usa o mesmo predicate).
  useEffect(() => {
    if (viewLevel === "tab" || viewLevel === "group" || viewLevel === "global-legado") {
      setFilters(DEFAULT_FILTERS);
    }
  }, [viewLevel]);

  const filterPredicate = useMemo(() => buildFilterPredicate(filters), [filters]);
  const hasActiveFilter = Boolean(filters.search || filters.status || filters.segmentId || filters.assetType);
  return { filters, setFilters, filterPredicate, hasActiveFilter };
}
