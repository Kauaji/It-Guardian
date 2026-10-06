import { X } from "lucide-react";
import { formatCurrency } from "../utils/money.js";

// Itens com valor e totais (Business): pecas adicionadas, servico e total estimado.
export default function FinancialPanel({ finance, onRemovePart }) {
  const { serviceItems, partsTotal, serviceValueNumber, totalValue } = finance;
  return (
    <div className="service-order-financial-panel service-order-financial-panel-standalone">
      {serviceItems.length ? (
        <div className="service-order-items-list">
          {serviceItems.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
              </div>
              <strong>{formatCurrency(item.subtotal)}</strong>
              <button type="button" className="icon-button danger" onClick={() => onRemovePart(item.id)} title="Remover peça">
                <X size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">Nenhuma peça com valor adicionada.</p>
      )}
      <div className="service-order-totals">
        <span>Total de peças <strong>{formatCurrency(partsTotal)}</strong></span>
        <span>Serviço <strong>{formatCurrency(serviceValueNumber)}</strong></span>
        <span className="grand-total">Total estimado <strong>{formatCurrency(totalValue)}</strong></span>
      </div>
    </div>
  );
}
