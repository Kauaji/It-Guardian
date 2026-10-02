import { useMemo, useState } from "react";
import { createSliceContext } from "./createSliceContext.jsx";

const [Provider, useAlertFilters] = createSliceContext("useAlertFilters");

export { useAlertFilters };

// Filtros da central de Avisos. Ficam acima das rotas para sobreviverem a
// troca de visao, como acontecia quando tudo vivia no Dashboard.
export function AlertFiltersProvider({ children }) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState("all");

  const value = useMemo(
    () => ({
      severityFilter,
      setSeverityFilter,
      statusFilter,
      setStatusFilter,
      suggestionStatusFilter,
      setSuggestionStatusFilter
    }),
    [severityFilter, statusFilter, suggestionStatusFilter]
  );

  return <Provider value={value}>{children}</Provider>;
}
