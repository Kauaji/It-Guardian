import { formatCurrency } from "../utils/money.js";

// Valores da OS, ocultos na tela e exibidos apenas ao imprimir pelo navegador.
export default function PrintFinancialSection({ serviceItems, serviceValueNumber, partsTotal, totalValue }) {
  return (
    <section className="service-order-print-financial" aria-hidden="true">
      <h3>Valores da Ordem de Serviço</h3>
      <div className="service-order-print-financial-grid">
        <span>Valor do serviço</span>
        <strong>{formatCurrency(serviceValueNumber)}</strong>
        <span>Total de peças</span>
        <strong>{formatCurrency(partsTotal)}</strong>
        <span>Total geral</span>
        <strong>{formatCurrency(totalValue)}</strong>
      </div>
      {serviceItems.length ? (
        <table>
          <thead>
            <tr>
              <th>Peça/produto</th>
              <th>Qtd.</th>
              <th>Valor unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {serviceItems.map((item) => (
              <tr key={`print-${item.id}`}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unitPrice)}</td>
                <td>{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Sem peças/produtos com valor registrados.</p>
      )}
    </section>
  );
}
