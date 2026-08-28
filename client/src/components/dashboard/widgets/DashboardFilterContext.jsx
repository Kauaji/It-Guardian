import { Filter, MousePointer2, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const emptyFilters = {};
const DashboardFilterContext = createContext({
  filters: emptyFilters, requestFilters: emptyFilters, selections: emptyFilters,
  enabled: false, pending: false, toggleFilter: () => {}, clearFilters: () => {}, removeFilter: () => {}
});

export function useDashboardFilters() {
  return useContext(DashboardFilterContext);
}

export function DashboardFilterProvider({ children, enabled = true }) {
  const [selections, setSelections] = useState({});
  const [requestFilters, setRequestFilters] = useState({});
  const filters = useMemo(() => Object.fromEntries(Object.entries(selections).map(([key, item]) => [key, item.value])), [selections]);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => setRequestFilters(filters), 180);
    return () => window.clearTimeout(timer);
  }, [filterKey]);

  function toggleFilter(dimension, value, label) {
    if (!enabled || value == null || value === "") return;
    setSelections((current) => {
      const next = { ...current };
      if (next[dimension]?.value === value) delete next[dimension];
      else next[dimension] = { value, label: label || String(value) };
      return next;
    });
  }

  function removeFilter(dimension) {
    setSelections((current) => {
      const next = { ...current };
      delete next[dimension];
      return next;
    });
  }

  const value = {
    filters, selections, requestFilters, enabled, toggleFilter, removeFilter,
    clearFilters: () => setSelections({}), pending: filterKey !== JSON.stringify(requestFilters)
  };
  return <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>;
}

const dimensionLabels = {
  assetStatus: "Status", assetId: "Ativo", alertSeverity: "Severidade",
  serviceOrderStatus: "OS", overdue: "Prazo"
};

export function DashboardFilterBar() {
  const { selections, removeFilter, clearFilters, enabled, pending } = useDashboardFilters();
  const entries = Object.entries(selections);
  return (
    <section className="dashboard-filter-bar" aria-label="Filtros do dashboard">
      <div className="dashboard-filter-hint">
        {entries.length ? <Filter size={15} /> : <MousePointer2 size={15} />}
        <span>{entries.length ? "Análise filtrada" : "Explore os dados"}</span>
        <small>{enabled ? "Clique em uma barra, fatia, indicador ou ativo para cruzar os dados." : "Filtros por clique pausados durante a edição."}</small>
      </div>
      {entries.length > 0 && (
        <div className="dashboard-filter-chips">
          {entries.map(([dimension, selection]) => (
            <button key={dimension} type="button" className="dashboard-filter-chip" onClick={() => removeFilter(dimension)} aria-label={"Remover filtro " + dimensionLabels[dimension] + ": " + selection.label}>
              <span>{dimensionLabels[dimension]}: <strong>{selection.label}</strong></span><X size={13} />
            </button>
          ))}
          <button type="button" className="dashboard-filter-clear" onClick={clearFilters}>Limpar filtros</button>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">{pending ? "Aplicando filtros aos widgets" : entries.length ? entries.length + " filtro(s) ativo(s)" : "Exibindo todos os dados"}</span>
    </section>
  );
}
