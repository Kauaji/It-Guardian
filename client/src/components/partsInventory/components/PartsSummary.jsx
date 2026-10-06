import { Boxes, CheckCircle2, Cpu, TriangleAlert, Warehouse } from "lucide-react";

export default function PartsSummary({ summary }) {
  return (
    <div className="parts-summary">
      <div className="summary-catalog">
        <Boxes />
        <span>
          Itens rastreados<strong>{summary.catalog}</strong>
        </span>
      </div>
      <div className="summary-stock">
        <Warehouse />
        <span>
          Unidades disponíveis<strong>{summary.available}</strong>
        </span>
      </div>
      <div className="summary-installed">
        <Cpu />
        <span>
          Componentes em uso<strong>{summary.inUse}</strong>
        </span>
      </div>
      <div className={`summary-alerts ${summary.discrepancies ? "warning" : ""}`}>
        {summary.discrepancies ? <TriangleAlert /> : <CheckCircle2 />}
        <span>
          Incongruências<strong>{summary.discrepancies}</strong>
        </span>
      </div>
    </div>
  );
}
