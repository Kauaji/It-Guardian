import { EVENT_STATUS_LABELS, EVENT_TYPE_META } from "../calendarModel.js";

const PRIORITY_FILTER_OPTIONS = [
  ["low", "Baixa"],
  ["normal", "Normal"],
  ["high", "Alta"],
  ["urgent", "Urgente"]
];

function FilterSelect({ label, ariaLabel, value, onChange, allLabel = "Todos", children }) {
  return (
    <label>
      <span>{label}</span>
      <select aria-label={ariaLabel} value={value} onChange={onChange}>
        <option value="">{allLabel}</option>
        {children}
      </select>
    </label>
  );
}

const options = (items) =>
  items.map((item) => (
    <option key={item.id} value={item.id}>
      {item.name}
    </option>
  ));

export default function CalendarFilters({ filters, technicians, groups, filterSegments, serviceOrders, onChange, onChangeGroup }) {
  return (
    <div className="calendar-filters" id="calendar-filter-panel">
      <div className="calendar-filter-rail">
        <FilterSelect label="Técnico" ariaLabel="Filtrar por técnico" value={filters.technicianId} onChange={onChange("technicianId")}>
          {options(technicians)}
        </FilterSelect>
        <FilterSelect label="Tipo" ariaLabel="Filtrar por tipo" value={filters.eventType} onChange={onChange("eventType")}>
          {Object.entries(EVENT_TYPE_META).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Status" ariaLabel="Filtrar por status" value={filters.status} onChange={onChange("status")}>
          {Object.entries(EVENT_STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Prioridade"
          ariaLabel="Filtrar por prioridade"
          value={filters.priority}
          onChange={onChange("priority")}
          allLabel="Todas"
        >
          {PRIORITY_FILTER_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Grupo" ariaLabel="Filtrar por grupo" value={filters.groupId} onChange={onChangeGroup}>
          {options(groups)}
        </FilterSelect>
        <FilterSelect label="Segmento" ariaLabel="Filtrar por segmento" value={filters.segmentId} onChange={onChange("segmentId")}>
          {options(filterSegments)}
        </FilterSelect>
        <FilterSelect
          label="OS"
          ariaLabel="Filtrar por OS"
          value={filters.serviceOrderId}
          onChange={onChange("serviceOrderId")}
          allLabel="Todas"
        >
          {serviceOrders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} · {item.title}
            </option>
          ))}
        </FilterSelect>
      </div>
    </div>
  );
}
