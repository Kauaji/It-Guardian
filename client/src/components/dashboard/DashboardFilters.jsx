import { RefreshCw } from "lucide-react";

const periods = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" }
];

export default function DashboardFilters({ period, onChangePeriod, onRefresh, refreshing }) {
  return (
    <section className="toolbar dashboard-filters">
      <label className="dashboard-period-filter">
        <span className="sr-only">Periodo do resumo</span>
        <select value={period} onChange={(event) => onChangePeriod(event.target.value)}>
          {periods.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
      <button type="button" className="secondary-action" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw size={16} className={refreshing ? "spin" : ""} />
        Atualizar
      </button>
    </section>
  );
}
