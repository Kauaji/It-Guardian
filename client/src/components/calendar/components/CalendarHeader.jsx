import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { formatHeader } from "../utils/calendarPage.js";

export default function CalendarHeader({
  search,
  onSearch,
  anchor,
  onMove,
  canCreate,
  onNew,
  filtersOpen,
  activeFilterCount,
  onToggleFilters
}) {
  return (
    <header className="calendar-page-heading">
      <div className="calendar-heading-copy">
        <span className="calendar-eyebrow">
          <CalendarDays size={16} /> Planejamento operacional
        </span>
        <h2>Agenda Técnica</h2>
        <p>OS, visitas, preventivas e verificações organizadas em uma única linha do tempo.</p>
      </div>
      <div className="calendar-command-bar">
        <label className="calendar-search">
          <Search size={18} />
          <input value={search} onChange={onSearch} placeholder="Pesquisar evento, OS ou técnico" />
        </label>
        <div className="calendar-command-actions">
          <div className="calendar-navigation">
            <button type="button" className="icon-button" onClick={() => onMove(-1)} aria-label="Mês anterior">
              <ChevronLeft />
            </button>
            <span>
              <CalendarDays size={17} />
              <strong>{formatHeader(anchor)}</strong>
            </span>
            <button type="button" className="icon-button" onClick={() => onMove(1)} aria-label="Próximo mês">
              <ChevronRight />
            </button>
          </div>
          {canCreate ? (
            <button
              type="button"
              className="primary-action calendar-add-action"
              onClick={onNew}
              aria-label="Novo agendamento"
              title="Novo agendamento"
            >
              <Plus size={20} />
            </button>
          ) : null}
          <button
            type="button"
            className={`calendar-filter-toggle ${filtersOpen ? "active" : ""}`}
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            aria-controls="calendar-filter-panel"
            aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            title={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
          >
            <ChevronDown size={19} />
            {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
