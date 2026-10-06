import { useState } from "react";
import { countActiveFilters, EMPTY_FILTERS, filterSegmentsFor } from "../utils/calendarPage.js";

// Filtros da agenda e visibilidade do painel. Trocar o grupo limpa o segmento escolhido.
export function useCalendarFilters(segments) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const setFilter = (field) => (e) => setFilters((current) => ({ ...current, [field]: e.target.value }));
  const setGroupFilter = (e) => setFilters((current) => ({ ...current, groupId: e.target.value, segmentId: "" }));
  return {
    filters,
    filtersOpen,
    toggleFilters: () => setFiltersOpen((open) => !open),
    setFilter,
    setGroupFilter,
    filterSegments: filterSegmentsFor(segments, filters.groupId),
    activeFilterCount: countActiveFilters(filters)
  };
}
