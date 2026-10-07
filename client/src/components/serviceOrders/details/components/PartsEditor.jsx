import { ChevronDown, Plus } from "lucide-react";
import { describeProduct } from "../utils/catalog.js";

function ProductSuggestions({ parts }) {
  const { suggestions, search } = parts;
  const typed = search.trim();
  return (
    <div className="service-order-suggestions" role="listbox">
      {suggestions.map((product) => {
        const description = describeProduct(product);
        return (
          <button
            key={product.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => parts.selectProduct(product.id)}
          >
            <strong>{product.name}</strong>
            {description && <span>{description}</span>}
          </button>
        );
      })}
      {!suggestions.length && typed && (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={parts.addPart}>
          <strong>Usar "{typed}"</strong>
          <span>Registrar peça digitada manualmente</span>
        </button>
      )}
    </div>
  );
}

// Secao recolhivel "Pecas trocadas": produto, categoria/marca (somente leitura), quantidade e valor.
export default function PartsEditor({ parts, products, businessMode }) {
  const { open, search, partDraft, suggestionsOpen, suggestions, selectedProduct } = parts;
  return (
    <section className={`service-order-collapsible-editor ${open ? "open" : ""}`}>
      <button type="button" className="service-order-section-toggle" onClick={parts.toggleOpen} aria-expanded={open}>
        <span>
          <strong>Peças trocadas</strong>
          <small>Registre produtos ou peças usadas no atendimento.</small>
        </span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="service-order-section-body">
          <div className={`service-order-parts-grid ${businessMode ? "business" : ""}`}>
            <label className="service-order-part-product-field">
              Produto/peça
              <div className="service-order-autocomplete">
                <input
                  value={search}
                  onChange={(event) => parts.changeSearch(event.target.value)}
                  onFocus={parts.openSuggestions}
                  onBlur={parts.closeSuggestionsSoon}
                  placeholder="Digite para buscar uma peça"
                  autoComplete="off"
                />
                {suggestionsOpen && (suggestions.length > 0 || search.trim()) && <ProductSuggestions parts={parts} />}
              </div>
            </label>
            <label className="service-order-part-category-field">
              Categoria
              <input value={selectedProduct?.category || "Não informado"} readOnly />
            </label>
            <label className="service-order-part-brand-field">
              Marca
              <input value={selectedProduct?.brand || "Não informado"} readOnly />
            </label>
            <label className="service-order-part-quantity-field">
              Quantidade
              <input type="number" min="1" value={partDraft.quantity} onChange={(event) => parts.changeQuantity(event.target.value)} />
            </label>
            {businessMode && (
              <label className="service-order-part-price-field">
                Valor unitário
                <input
                  type="text"
                  inputMode="decimal"
                  value={partDraft.unitPrice}
                  onChange={(event) => parts.changeUnitPrice(event.target.value)}
                  placeholder="R$ 0,00"
                />
              </label>
            )}
            <button
              type="button"
              className="primary-action compact-action service-order-add-icon"
              onClick={parts.addPart}
              disabled={!partDraft.productId && !search.trim()}
              title="Adicionar peça"
              aria-label="Adicionar peça"
            >
              <Plus size={18} />
            </button>
          </div>
          {!products.length && <p className="empty">Nenhuma peça cadastrada. Cadastre peças nas Configurações da OS.</p>}
        </div>
      )}
    </section>
  );
}
