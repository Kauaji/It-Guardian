import {
  assetStatusOptions,
  connectionModeOptions,
  originOptions,
  priorityOptions,
  remoteAssistanceStatusOptions,
  riskLevelOptions,
  scriptStatusOptions,
  severityOptions
} from "./reportUtils.js";

const selectFieldsByKey = {
  priority: { label: "Prioridade", options: priorityOptions },
  origin: { label: "Origem", options: originOptions },
  severity: { label: "Severidade", options: severityOptions },
  riskLevel: { label: "Risco", options: riskLevelOptions }
};

const textFieldsByKey = {
  environmentName: "Ambiente/cliente",
  technician: "Tecnico",
  segmentName: "Segmento",
  assetType: "Tipo de ativo",
  category: "Categoria do aviso",
  search: "Buscar"
};

function statusOptionsFor(typeId) {
  if (typeId === "assets") return assetStatusOptions;
  if (typeId === "scripts") return scriptStatusOptions;
  if (typeId === "remote_assistance") return remoteAssistanceStatusOptions;
  return null;
}

export default function ReportFilters({ type, filters, onChange }) {
  if (!type) return null;

  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  const statusOptions = statusOptionsFor(type.id);

  return (
    <section className="toolbar report-filters">
      {type.filters.includes("startDate") && (
        <label>
          <span className="sr-only">Data inicial</span>
          <input
            type="date"
            value={filters.startDate || ""}
            onChange={(event) => set("startDate", event.target.value)}
          />
        </label>
      )}
      {type.filters.includes("endDate") && (
        <label>
          <span className="sr-only">Data final</span>
          <input
            type="date"
            value={filters.endDate || ""}
            onChange={(event) => set("endDate", event.target.value)}
          />
        </label>
      )}
      {type.filters.includes("status") && (
        statusOptions ? (
          <select value={filters.status || "all"} onChange={(event) => set("status", event.target.value)}>
            <option value="all">Todos os status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Status (id configurado)"
            value={filters.status || ""}
            onChange={(event) => set("status", event.target.value)}
          />
        )
      )}
      {type.filters.includes("connectionMode") && (
        <select value={filters.connectionMode || "all"} onChange={(event) => set("connectionMode", event.target.value)}>
          <option value="all">Todos os transportes</option>
          {connectionModeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}
      {Object.entries(selectFieldsByKey)
        .filter(([key]) => type.filters.includes(key))
        .map(([key, field]) => (
          <select key={key} value={filters[key] || "all"} onChange={(event) => set(key, event.target.value)}>
            <option value="all">{field.label}: todas</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ))}
      {Object.entries(textFieldsByKey)
        .filter(([key]) => type.filters.includes(key))
        .map(([key, label]) => (
          <input
            key={key}
            type="text"
            placeholder={label}
            value={filters[key] || ""}
            onChange={(event) => set(key, event.target.value)}
          />
        ))}
    </section>
  );
}
