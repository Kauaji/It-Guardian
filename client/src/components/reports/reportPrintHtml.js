import { REPORT_TABLE_COLUMNS } from "./reportUtils.js";

/**
 * Mesmo padrao de impressao de ServiceOrderDetailsModal.jsx (`printServiceOrder`,
 * popup + HTML/CSS proprios) - nao um bloco `@media print` em styles.css.
 * O unico `@media print` existente no projeto tem um `@page { size: 50mm 30mm }`
 * global para etiqueta de QR Code, que colidiria com uma impressao de pagina
 * inteira se dividissem o mesmo mecanismo.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCell(value) {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  return String(value);
}

function buildTableRows(columns, rows) {
  if (!rows.length) {
    return `<tr><td colspan="${columns.length}">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
  }
  return rows
    .map(
      (row) => `
        <tr>
          ${columns.map((column) => `<td>${escapeHtml(formatCell(row[column.key]))}</td>`).join("")}
        </tr>
      `
    )
    .join("");
}

function buildSummaryCards(summary = {}) {
  const flatEntries = Object.entries(summary).filter(([, value]) => typeof value === "number" || typeof value === "string");
  if (!flatEntries.length) return "";

  return `
    <div class="grid">
      ${flatEntries
        .map(
          ([key, value]) => `
            <div class="card">
              <span>${escapeHtml(key)}</span>
              <strong>${escapeHtml(formatCell(value))}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

export function buildReportPrintHtml({ typeId, typeLabel, generatedAt, data }) {
  const columns = REPORT_TABLE_COLUMNS[typeId] || [];
  const rows = data?.rows || [];
  const warnings = data?.warnings || [];

  const warningsSection = warnings.length
    ? `
      <section>
        <h2>Observacoes</h2>
        <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      </section>
    `
    : "";

  return `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(typeLabel)} - IT Guardian</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #dbe4ef; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 22px; }
          h2 { margin: 22px 0 10px; font-size: 16px; }
          p { margin: 4px 0; color: #475569; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .card { border: 1px solid #dbe4ef; border-radius: 10px; padding: 10px; min-height: 56px; }
          .card span { display: block; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
          .card strong { display: block; margin-top: 6px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #dbe4ef; padding: 7px; text-align: left; font-size: 11px; }
          th { background: #f1f5f9; }
          ul { margin: 4px 0; padding-left: 18px; color: #475569; font-size: 12px; }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${escapeHtml(typeLabel)}</h1>
            <p>Relatorio gerado em ${escapeHtml(generatedAt)} - IT Guardian</p>
          </div>
        </header>
        ${buildSummaryCards(data?.summary)}
        ${warningsSection}
        <section>
          <h2>Detalhamento</h2>
          <table>
            <thead>
              <tr>${columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("")}</tr>
            </thead>
            <tbody>${buildTableRows(columns, rows)}</tbody>
          </table>
        </section>
      </body>
    </html>
  `;
}

export function openReportPrintWindow({ typeId, typeLabel, generatedAt, data, notify }) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    notify?.("Nao foi possivel abrir a janela de impressao.", "danger");
    return;
  }
  popup.document.write(buildReportPrintHtml({ typeId, typeLabel, generatedAt, data }));
  popup.document.close();
}
