import { BarChart3 } from "lucide-react";
import SummaryCard from "../ui/SummaryCard.jsx";
import { REPORT_TABLE_COLUMNS } from "./reportUtils.js";

/**
 * Rotulos conhecidos para as chaves de `summary` dos 7 tipos de relatorio
 * (todas definidas em server/src/domain/reportBuilders.js) - sem isso, o
 * card ficava com o nome cru da propriedade em ingles (ex.: "Assets - With
 * Error"). Chave sem entrada aqui cai no humanizador generico abaixo.
 */
const SUMMARY_KEY_LABELS = {
  startDate: "Data inicial",
  endDate: "Data final",
  period: "Periodo",
  assets: "Ativos",
  total: "Total",
  online: "Online",
  offline: "Offline",
  withError: "Com erro",
  serviceOrders: "Ordens de Servico",
  createdInPeriod: "Criadas no periodo",
  closedInPeriod: "Fechadas no periodo",
  avgResolutionMinutes: "Tempo medio de resolucao (min)",
  avgFirstResponseMinutes: "Tempo medio de primeira resposta (min)",
  overdueNow: "Vencidas agora",
  nearDueNow: "Perto do vencimento agora",
  alerts: "Alertas",
  inPeriod: "No periodo",
  critical: "Criticas",
  infrastructureHealthNow: "Saude da infraestrutura",
  score: "Nota",
  classification: "Classificacao (codigo)",
  classificationLabel: "Classificacao",
  totalCount: "Total",
  notApplicableCount: "Nao se aplica",
  applicableTotal: "Total aplicavel",
  open: "Abertas",
  closed: "Fechadas",
  onTrack: "No prazo",
  nearDue: "Perto do vencimento",
  breachedOpen: "Vencidas (abertas)",
  resolved: "Concluidas no prazo",
  breachedClosed: "Vencidas (fechadas)",
  closedCompliancePercent: "Cumprimento de prazo (%)",
  avgFeedbackRating: "Nota media do feedback",
  successRate: "Taxa de sucesso (%)",
  timeoutRate: "Taxa de timeout (%)",
  averageDurationMinutes: "Duracao media (min)",
  alertsWithSuggestionCount: "Com sugestao de OS",
  alertsThatBecameServiceOrderCount: "Viraram OS",
  byStatus: "Por status",
  byPriority: "Por prioridade",
  byOrigin: "Por origem",
  byTechnician: "Por tecnico",
  byType: "Por tipo",
  bySegment: "Por segmento",
  bySeverity: "Por severidade",
  byCategory: "Por categoria",
  byRiskLevel: "Por risco",
  byConnectionMode: "Por transporte",
  byEndReason: "Por motivo de encerramento",
  byEnvironment: "Por ambiente"
};

function humanizeKey(key) {
  if (SUMMARY_KEY_LABELS[key]) return SUMMARY_KEY_LABELS[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

function isCountArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === "object" && "count" in item);
}

/**
 * O formato de `summary` varia por tipo de relatorio (campos escalares,
 * objetos aninhados como `sla.open`, listas `byX` de {key,label,count}) -
 * em vez de um componente por tipo, achata tudo em cards + blocos de
 * distribuicao de forma generica, ate 2 niveis de profundidade.
 */
function collectSummaryCards(summary, prefix = "") {
  const cards = [];
  const breakdowns = [];

  for (const [key, value] of Object.entries(summary || {})) {
    if (value == null || value === "") continue;
    const label = prefix ? `${prefix} - ${humanizeKey(key)}` : humanizeKey(key);

    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      cards.push({ label, value });
    } else if (isCountArray(value)) {
      breakdowns.push({ label, items: value });
    } else if (typeof value === "object" && !Array.isArray(value) && prefix === "") {
      const nested = collectSummaryCards(value, label);
      cards.push(...nested.cards);
      breakdowns.push(...nested.breakdowns);
    }
  }

  return { cards, breakdowns };
}

function formatCellValue(value) {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  return String(value);
}

export default function ReportPreview({ type, data, loading, error }) {
  if (!type) return null;
  if (loading) return <p className="empty-state">Carregando relatorio...</p>;
  if (error) return <p className="empty-state danger">{error}</p>;
  if (!data) return null;

  const columns = REPORT_TABLE_COLUMNS[type.id] || [];
  const { cards, breakdowns } = collectSummaryCards(data.summary);

  return (
    <div className="report-preview">
      {data.warnings?.length > 0 && (
        <ul className="alert-stack report-warnings">
          {data.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {cards.length > 0 && (
        <div className="summary-grid">
          {cards.map((card) => (
            <SummaryCard key={card.label} icon={BarChart3} label={card.label} value={card.value} />
          ))}
        </div>
      )}

      {breakdowns.map((breakdown) => (
        <div key={breakdown.label} className="report-breakdown">
          <h4>{breakdown.label}</h4>
          <div className="report-breakdown-pills">
            {breakdown.items.map((item) => (
              <span key={item.key} className="pill">
                {item.label}: {item.count}
              </span>
            ))}
          </div>
        </div>
      ))}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>Nenhum registro encontrado para os filtros selecionados.</td>
              </tr>
            ) : (
              data.rows.map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((column) => (
                    <td key={column.key}>{formatCellValue(row[column.key])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
