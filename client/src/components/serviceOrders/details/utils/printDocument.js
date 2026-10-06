import { priorityLabels } from "../../serviceOrderBoardUtils.js";
import { formatCurrency } from "./money.js";
import { escapeHtml, formatDate } from "./text.js";

// Documento HTML (A4) impresso pela janela "Imprimir OS". Texto escapado; sem dependencias de React.
export function buildPrintDocument({
  serviceOrder,
  draft,
  asset,
  statusLabelMap,
  environmentLabel,
  businessMode,
  serviceItems,
  serviceValueNumber,
  partsTotal,
  totalValue
}) {
  const itemsRows = serviceItems.length
    ? serviceItems.map((item) => `
          <tr>
            <td>${escapeHtml(item.productName)}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${escapeHtml(formatCurrency(item.unitPrice))}</td>
            <td>${escapeHtml(formatCurrency(item.subtotal))}</td>
          </tr>
        `).join("")
    : `<tr><td colspan="4">Sem peças/produtos com valor registrados.</td></tr>`;

  const financialSection = (businessMode || serviceValueNumber || partsTotal || serviceItems.length) ? `
      <section>
        <h2>Valores</h2>
        <div class="totals">
          <span>Valor do serviço <strong>${escapeHtml(formatCurrency(serviceValueNumber))}</strong></span>
          <span>Total de peças <strong>${escapeHtml(formatCurrency(partsTotal))}</strong></span>
          <span>Total geral <strong>${escapeHtml(formatCurrency(totalValue))}</strong></span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Peça/produto</th>
              <th>Qtd.</th>
              <th>Valor unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>
      </section>
    ` : "";

  return `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(serviceOrder.number)} - IT Guardian</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
            header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #dbe4ef; padding-bottom: 14px; margin-bottom: 18px; }
            h1 { margin: 0; font-size: 24px; }
            h2 { margin: 22px 0 10px; font-size: 16px; }
            p { margin: 4px 0; color: #475569; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .card { border: 1px solid #dbe4ef; border-radius: 10px; padding: 10px; min-height: 62px; }
            .card span { display: block; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
            .card strong { display: block; margin-top: 6px; font-size: 14px; }
            .text { white-space: pre-wrap; border: 1px solid #dbe4ef; border-radius: 10px; padding: 12px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #dbe4ef; padding: 9px; text-align: left; font-size: 12px; }
            th { background: #f1f5f9; }
            .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
            .totals span { border: 1px solid #dbe4ef; border-radius: 10px; padding: 10px; color: #475569; }
            .totals strong { display: block; margin-top: 4px; color: #111827; font-size: 15px; }
          </style>
        </head>
        <body>
          <header>
            <div>
              <p>IT Guardian - Ordem de Serviço</p>
              <h1>${escapeHtml(serviceOrder.number)} - ${escapeHtml(serviceOrder.title)}</h1>
              <p>${escapeHtml(statusLabelMap[serviceOrder.status] || serviceOrder.status)} - Prioridade ${escapeHtml(priorityLabels[serviceOrder.priority])}</p>
            </div>
            <div>
              <p>Aberta em</p>
              <strong>${escapeHtml(formatDate(serviceOrder.createdAt))}</strong>
            </div>
          </header>
          <section class="grid">
            <div class="card"><span>${escapeHtml(environmentLabel)}</span><strong>${escapeHtml(serviceOrder.environmentName || "Não informado")}</strong></div>
            <div class="card"><span>Setor</span><strong>${escapeHtml(serviceOrder.sectorName || "Geral")}</strong></div>
            <div class="card"><span>Solicitante</span><strong>${escapeHtml(serviceOrder.requesterName || "Não informado")}</strong></div>
            <div class="card"><span>Técnico</span><strong>${escapeHtml(serviceOrder.assignedTechnicianName || "Não informado")}</strong></div>
            <div class="card"><span>Categoria</span><strong>${escapeHtml(serviceOrder.category || "Não informado")}</strong></div>
            <div class="card"><span>Máquina/ativo</span><strong>${escapeHtml(asset?.name || serviceOrder.assetId || "Não informado")}</strong></div>
            <div class="card"><span>Finalizada em</span><strong>${escapeHtml(formatDate(serviceOrder.closedAt))}</strong></div>
          </section>
          <section>
            <h2>Solicitação</h2>
            <div class="text">${escapeHtml(serviceOrder.description || "Sem descrição informada.")}</div>
          </section>
          <section>
            <h2>Atendimento</h2>
            <div class="text">${escapeHtml([
              draft.servicePerformed || serviceOrder.servicePerformed ? `Serviço realizado: ${draft.servicePerformed || serviceOrder.servicePerformed}` : "",
              draft.diagnosis || serviceOrder.diagnosis ? `Diagnóstico: ${draft.diagnosis || serviceOrder.diagnosis}` : "",
              draft.attendanceNotes || serviceOrder.attendanceNotes ? `Observações: ${draft.attendanceNotes || serviceOrder.attendanceNotes}` : ""
            ].filter(Boolean).join("\n\n") || "Sem atendimento registrado.")}</div>
          </section>
          ${financialSection}
        </body>
      </html>
    `;
}
