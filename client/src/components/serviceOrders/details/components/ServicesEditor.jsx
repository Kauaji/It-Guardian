import { ChevronDown, Plus } from "lucide-react";

// Secao recolhivel "Servicos realizados": busca com sugestoes e valor do servico (Business).
export default function ServicesEditor({ selector, services, businessMode, draft, serviceValueNumber, updateDraft }) {
  const { open, search, suggestionsOpen, suggestions } = selector;
  const typed = search.trim();
  return (
    <section className={`service-order-collapsible-editor ${open ? "open" : ""}`}>
      <button type="button" className="service-order-section-toggle" onClick={selector.toggleOpen} aria-expanded={open}>
        <span>
          <strong>Serviços realizados</strong>
          <small>Classifique o procedimento feito pelo técnico.</small>
        </span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="service-order-section-body service-order-service-selector">
          <label className="service-order-service-field">
            Serviço
            <div className="service-order-autocomplete">
              <input
                value={search}
                onChange={(event) => selector.changeSearch(event.target.value)}
                onFocus={selector.openSuggestions}
                onBlur={selector.closeSuggestionsSoon}
                placeholder="Digite para buscar um serviço"
                autoComplete="off"
              />
              {suggestionsOpen && (suggestions.length > 0 || typed) && (
                <div className="service-order-suggestions" role="listbox">
                  {suggestions.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selector.selectService(service)}
                    >
                      <strong>{service.name}</strong>
                      {service.category && <span>{service.category}</span>}
                    </button>
                  ))}
                  {!suggestions.length && typed && (
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={selector.confirmService}>
                      <strong>Usar "{typed}"</strong>
                      <span>Registrar serviço digitado manualmente</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </label>
          <button
            type="button"
            className="primary-action compact-action service-order-add-icon"
            onClick={selector.confirmService}
            disabled={!selector.selectedServiceId && !typed}
            title="Adicionar serviço"
            aria-label="Adicionar serviço"
          >
            <Plus size={18} />
          </button>
          {businessMode && (
            <label className="service-order-service-value-field">
              Valor do serviço
              <input
                type="text"
                inputMode="decimal"
                value={draft.serviceValue}
                onChange={(event) => updateDraft("serviceValue", event.target.value)}
                onBlur={() => updateDraft("serviceValue", String(serviceValueNumber))}
                placeholder="R$ 0,00"
              />
            </label>
          )}
          {!services.length && <p className="empty">Nenhum serviço cadastrado. Cadastre serviços nas Configurações da OS.</p>}
        </div>
      )}
    </section>
  );
}
