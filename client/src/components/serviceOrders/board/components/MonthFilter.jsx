import { Calendar } from "lucide-react";
import { formatMonthFilterLabel, formatShortMonth } from "../../serviceOrderBoardUtils.js";

function MonthPopover({ monthFilter, picker, onSelectMonth, onClearMonth, onClose }) {
  const { mode, year, availableYears, monthsForYear } = picker;
  return (
    <div className="service-order-month-popover">
      <header className="service-order-month-picker-header">
        <button type="button" className="ghost-action compact-action" onClick={picker.toggleMode}>
          {year}
        </button>
        <span>{mode === "years" ? "Selecione o ano" : "Selecione o mês"}</span>
      </header>
      {mode === "years" ? (
        <div className="service-order-year-grid">
          {availableYears.length ? (
            availableYears.map((value) => (
              <button key={value} type="button" className={value === year ? "active" : ""} onClick={() => picker.pickYear(value)}>
                {value}
              </button>
            ))
          ) : (
            <p className="empty">Nenhuma OS cadastrada.</p>
          )}
        </div>
      ) : (
        <div className="service-order-month-grid">
          {monthsForYear.length ? (
            monthsForYear.map((value) => (
              <button key={value} type="button" className={value === monthFilter ? "active" : ""} onClick={() => onSelectMonth(value)}>
                {formatShortMonth(value)}
              </button>
            ))
          ) : (
            <p className="empty">Sem OS neste ano.</p>
          )}
        </div>
      )}
      <div className="service-order-month-popover-actions">
        <button type="button" className="ghost-action compact-action" onClick={onClearMonth}>
          Todos os meses
        </button>
        <button type="button" className="primary-action compact-action" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// Filtro por mes de abertura: botao com o mes atual e popover de selecao de ano/mes.
export default function MonthFilter({ monthFilter, open, picker, onToggle, onSelectMonth, onClearMonth, onClose }) {
  return (
    <div className="service-order-month-filter" aria-label="Filtro por mês de abertura">
      <button
        type="button"
        className="service-order-month-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-label="Selecionar mês de abertura"
        title="Selecionar mês"
      >
        <Calendar size={16} />
        <span>{formatMonthFilterLabel(monthFilter)}</span>
      </button>
      {open && (
        <MonthPopover
          monthFilter={monthFilter}
          picker={picker}
          onSelectMonth={onSelectMonth}
          onClearMonth={onClearMonth}
          onClose={onClose}
        />
      )}
    </div>
  );
}
