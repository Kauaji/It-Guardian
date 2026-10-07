import { generalSector, originFilterOptions, priorityLabels, ratingFilterOptions, slaFilterOptions } from "../../serviceOrderBoardUtils.js";

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="service-order-sector-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function OptionList({ options }) {
  return options.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}

// Popover de filtros: cliente (Business), setor, prioridade, tecnico, status, SLA, origem e avaliacao.
export default function BoardFilters({
  filters,
  setters,
  businessMode,
  canViewAllClients,
  canViewAllSectors,
  clients,
  technicians,
  availableSectors,
  configuredStatuses
}) {
  return (
    <div className="service-order-filter-row service-order-filter-popover" aria-label="Filtros de Ordens de Serviço">
      {businessMode && canViewAllClients && (
        <FilterSelect label="Cliente" value={filters.clientFilter} onChange={setters.setClientFilter}>
          <option value="all">Todos os clientes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.tradeName || client.legalName || "Cliente sem nome"}
            </option>
          ))}
        </FilterSelect>
      )}
      <FilterSelect label={businessMode ? "Setor/local" : "Setor"} value={filters.sectorFilter} onChange={setters.setSectorFilter}>
        {canViewAllSectors && <option value="all">Todos os setores</option>}
        <option value="mine">Meu setor</option>
        <option value={generalSector.id}>Geral</option>
        {availableSectors
          .filter((sector) => sector.id !== generalSector.id)
          .map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
      </FilterSelect>
      <FilterSelect label="Prioridade" value={filters.priorityFilter} onChange={setters.setPriorityFilter}>
        <option value="all">Todas</option>
        {Object.entries(priorityLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Técnico" value={filters.technicianFilter} onChange={setters.setTechnicianFilter}>
        <option value="all">Todos</option>
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.name}>
            {technician.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Status" value={filters.statusFilter} onChange={setters.setStatusFilter}>
        <option value="all">Todos</option>
        {configuredStatuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Prazo (SLA)" value={filters.slaFilter} onChange={setters.setSlaFilter}>
        <OptionList options={slaFilterOptions} />
      </FilterSelect>
      <FilterSelect label="Origem" value={filters.originFilter} onChange={setters.setOriginFilter}>
        <OptionList options={originFilterOptions} />
      </FilterSelect>
      <FilterSelect label="Avaliação" value={filters.ratingFilter} onChange={setters.setRatingFilter}>
        <OptionList options={ratingFilterOptions} />
      </FilterSelect>
    </div>
  );
}
