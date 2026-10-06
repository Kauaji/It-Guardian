import { ChevronDown, Search, Settings2, X } from "lucide-react";

const STATE_FILTERS = [
  ["", "Todo o inventário"],
  ["available", "Peças disponíveis"],
  ["in_use", "Peças em uso"]
];

export default function PartsToolbar({
  search,
  onSearch,
  inventoryState,
  onInventoryState,
  discrepancyOnly,
  onClearDiscrepancy,
  canManageCategories,
  onOpenCategories
}) {
  return (
    <div className="parts-toolbar">
      <label className="parts-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar peça, código, série, part number, MAC ou fornecedor"
        />
      </label>
      <details className="parts-state-filter">
        <summary aria-label="Filtrar disponibilidade" title="Filtrar disponibilidade">
          <ChevronDown size={19} />
        </summary>
        <div>
          {STATE_FILTERS.map(([value, label]) => (
            <button type="button" key={value} className={inventoryState === value ? "active" : ""} onClick={() => onInventoryState(value)}>
              {label}
            </button>
          ))}
        </div>
      </details>
      {discrepancyOnly ? (
        <button type="button" className="parts-clear-discrepancy" onClick={onClearDiscrepancy}>
          Limpar incongruências <X size={14} />
        </button>
      ) : null}
      {canManageCategories ? (
        <button type="button" className="icon-button parts-settings-button" onClick={onOpenCategories} aria-label="Configurar categorias">
          <Settings2 />
        </button>
      ) : null}
    </div>
  );
}
