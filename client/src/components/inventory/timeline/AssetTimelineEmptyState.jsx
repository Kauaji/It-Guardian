import { FileClock } from "lucide-react";

export default function AssetTimelineEmptyState({ hasFilters, onClearFilters }) {
  return (
    <div className="asset-timeline-empty">
      <FileClock size={28} />
      <p>
        {hasFilters
          ? "Nenhum evento encontrado para os filtros selecionados."
          : "Nenhum evento registrado para este ativo ainda."}
      </p>
      {hasFilters && (
        <button type="button" className="ghost-action" onClick={onClearFilters}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
