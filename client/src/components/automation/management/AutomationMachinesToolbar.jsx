import { Search } from "lucide-react";

export const machineStatusOptions = [
  ["all", "Todos"],
  ["active", "Ativos"],
  ["inactive", "Inativos"],
  ["error", "Com erro"],
  ["without_schedule", "Sem próxima agenda"]
];

export default function AutomationMachinesToolbar({ search, status, onSearch, onStatus }) {
  return (
    <div className="automation-management-toolbar machines-toolbar">
      <label className="compact-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar máquina, grupo, segmento, ambiente ou plano"
        />
      </label>
      <select value={status} onChange={(event) => onStatus(event.target.value)} aria-label="Filtrar automatizações por status">
        {machineStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
  );
}
