const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "problem", label: "Erro" },
  { value: "unknown", label: "Sem dados" }
];

export default function ToolbarFilters({ filters, onFiltersChange, segments, assetTypeOptions, lockSegmentFilter }) {
  return (
    <div className="network-topology-toolbar-row">
      <input
        type="search"
        className="network-topology-toolbar-input"
        placeholder="Buscar por nome ou IP"
        aria-label="Buscar por nome ou IP"
        value={filters.search}
        onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
      />
      <select
        className="network-topology-toolbar-select"
        aria-label="Filtrar por status"
        value={filters.status}
        onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {!lockSegmentFilter ? (
        <select
          className="network-topology-toolbar-select"
          aria-label="Filtrar por segmento"
          value={filters.segmentId}
          onChange={(event) => onFiltersChange({ ...filters, segmentId: event.target.value })}
        >
          <option value="">Todos os segmentos</option>
          {segments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>
      ) : null}
      <select
        className="network-topology-toolbar-select"
        aria-label="Filtrar por tipo de ativo"
        value={filters.assetType}
        onChange={(event) => onFiltersChange({ ...filters, assetType: event.target.value })}
      >
        <option value="">Todos os tipos</option>
        {assetTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
