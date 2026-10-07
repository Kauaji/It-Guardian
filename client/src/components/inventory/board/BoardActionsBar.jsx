import { ChevronDown, ListFilter, Plus, Search } from "lucide-react";
import BoardFilterPanel from "./BoardFilterPanel.jsx";

export default function BoardActionsBar({
  search,
  setSearch,
  searchFocused,
  setSearchFocused,
  filtersOpen,
  setFiltersOpen,
  canManage,
  onCreateManualAsset,
  onCreateSegment,
  onCreateGroup,
  ...filterProps
}) {
  return (
    <section className="inventory-tab-panel">
      <div className="inventory-board-actions">
        <div className={`search-box compact-search ${searchFocused || search ? "expanded" : ""}`}>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar máquina, IP, sistema ou segmento"
            aria-label="Buscar máquina, IP, sistema ou segmento"
          />
        </div>
        <button
          type="button"
          className={`inventory-filter-toggle ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
          aria-label="Filtros do inventário"
          title="Filtros do inventário"
        >
          <ListFilter size={18} />
          <span>Filtros</span>
          <ChevronDown size={16} />
        </button>
        {filtersOpen && <BoardFilterPanel {...filterProps} />}
        {canManage && (
          <div className="inventory-create-actions">
            <button className="primary-action compact-action" onClick={onCreateManualAsset}>
              <Plus size={16} />
              Ativo de rede
            </button>
            <button className="secondary-action compact-action" onClick={onCreateSegment}>
              <Plus size={16} />
              Segmento
            </button>
            <button className="secondary-action compact-action" onClick={onCreateGroup}>
              <Plus size={16} />
              Grupo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
