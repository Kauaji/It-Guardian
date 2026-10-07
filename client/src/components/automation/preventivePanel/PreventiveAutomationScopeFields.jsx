import { getScopeOptions, preventiveAutomationScopeLabels } from "./preventiveAutomationPanelUtils.js";

// Escopo do plano: tipo, lista de maquinas herdadas (assistente) ou alvo unico.
export default function PreventiveAutomationScopeFields({ form, scopeSources, onChange }) {
  return (
    <>
      <label>
        Escopo
        <select value={form.scopeType} onChange={(event) => onChange("scopeType", event.target.value)}>
          {Object.entries(preventiveAutomationScopeLabels)
            .filter(([value]) => value !== "asset_list" || form.scopeType === "asset_list")
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </label>
      {form.scopeType === "asset_list" && (
        <div className="preventive-automation-wide automation-asset-list-scope">
          <strong>Máquinas selecionadas</strong>
          <span>{(form.assetIds || []).length} máquina(s) herdada(s) da preventiva.</span>
          <div>
            {(form.assetIds || []).map((assetId) => {
              const device = scopeSources.devices.find((item) => String(item.id) === String(assetId));
              const label = device?.name || device?.hostname || assetId;
              return (
                <em key={assetId}>
                  {label} <small>{assetId}</small>
                </em>
              );
            })}
          </div>
        </div>
      )}
      {form.scopeType !== "all" && form.scopeType !== "asset_list" && (
        <label>
          Alvo
          <select value={form.scopeId} onChange={(event) => onChange("scopeId", event.target.value)} required>
            <option value="">Selecione</option>
            {getScopeOptions(form.scopeType, scopeSources).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
