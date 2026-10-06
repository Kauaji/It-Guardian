import { ChevronDown, Plus, Settings } from "lucide-react";
import BoardFilters from "./BoardFilters.jsx";
import MonthFilter from "./MonthFilter.jsx";
import OrderSearchField from "./OrderSearchField.jsx";

function BoardHeading({ businessMode }) {
  return (
    <div className="service-orders-heading">
      <div className="service-orders-title-row">
        <h2>Ordens de Serviço</h2>
        <span className={`service-order-mode-badge ${businessMode ? "business" : "internal"}`}>
          {businessMode ? "Modo Business" : "Modo Local"}
        </span>
      </div>
    </div>
  );
}

function HeaderButtons({ can, panels }) {
  return (
    <>
      {can.manageSettings && (
        <button
          type="button"
          className={`secondary-action compact-action service-order-settings-button icon-only ${panels.settingsOpen ? "active" : ""}`}
          onClick={panels.toggleSettings}
          title="Configurações da Ordem de Serviço"
          aria-label="Configurações da Ordem de Serviço"
        >
          <Settings size={18} />
        </button>
      )}
      {can.createOrders && (
        <button
          type="button"
          className="primary-action compact-action service-order-new-button icon-only"
          onClick={panels.openForm}
          title="Nova Ordem de Serviço"
          aria-label="Nova Ordem de Serviço"
        >
          <Plus size={18} />
        </button>
      )}
      <button
        type="button"
        className={`secondary-action compact-action icon-only service-order-filter-toggle ${panels.filtersOpen ? "active" : ""}`}
        onClick={panels.toggleFilters}
        title="Filtros"
        aria-label="Filtros de Ordens de Serviço"
        aria-expanded={panels.filtersOpen}
      >
        <ChevronDown size={18} />
      </button>
    </>
  );
}

// Cabecalho do quadro: titulo/modo, pesquisa, mes, botoes de acao e popover de filtros.
export default function BoardHeader({ businessMode, can, panels, search, month, filtersProps }) {
  return (
    <header className="service-orders-header">
      <BoardHeading businessMode={businessMode} />
      <OrderSearchField value={search.value} onChange={search.onChange} />
      <div className="service-orders-header-actions">
        <MonthFilter
          monthFilter={month.monthFilter}
          open={panels.monthPickerOpen}
          picker={month.picker}
          onToggle={panels.toggleMonthPicker}
          onSelectMonth={month.onSelectMonth}
          onClearMonth={month.onClearMonth}
          onClose={month.onClose}
        />
        <HeaderButtons can={can} panels={panels} />
      </div>
      {panels.filtersOpen && <BoardFilters {...filtersProps} />}
    </header>
  );
}
