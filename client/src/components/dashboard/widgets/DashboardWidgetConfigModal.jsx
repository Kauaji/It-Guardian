import { X } from "lucide-react";
import { useState } from "react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import AssetPickerField from "./AssetPickerField.jsx";
import { widgetRegistry } from "./widgetRegistry.js";

const periodOptions = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" }
];

export default function DashboardWidgetConfigModal({ token, widget, onSave, onClose }) {
  const dialogRef = useModalLifecycle(Boolean(widget), onClose);
  const [title, setTitle] = useState(widget?.title || "");
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(widget?.refreshIntervalSeconds || 60);
  const [config, setConfig] = useState(widget?.config || {});

  if (!widget) return null;
  const entry = widgetRegistry[widget.type];
  const configFields = entry?.configFields || [];

  function updateConfig(patch) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...widget,
      title: title.trim() || undefined,
      refreshIntervalSeconds: Number(refreshIntervalSeconds),
      config
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="modal-panel dashboard-widget-config-modal" role="dialog" aria-modal="true" aria-label="Configurar widget">
        <header>
          <h2>Configurar widget</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <label>
            Titulo
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={entry?.label}
              maxLength={60}
            />
          </label>

          {configFields.includes("asset") && (
            <AssetPickerField token={token} value={config.assetId} onChange={(assetId) => updateConfig({ assetId })} />
          )}

          {configFields.includes("period") && (
            <label>
              Periodo
              <select value={config.period || "24h"} onChange={(event) => updateConfig({ period: event.target.value })}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          )}

          {configFields.includes("limit") && (
            <label>
              Quantidade de itens
              <input
                type="number"
                min={1}
                max={30}
                value={config.limit || 5}
                onChange={(event) => updateConfig({ limit: Number(event.target.value) })}
              />
            </label>
          )}

          <label>
            Atualizar a cada
            <select value={refreshIntervalSeconds} onChange={(event) => setRefreshIntervalSeconds(event.target.value)}>
              <option value={30}>30s</option>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
            </select>
          </label>

          <div className="dashboard-widget-config-actions">
            <button type="button" className="secondary-action" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-action">Salvar</button>
          </div>
        </form>
      </section>
    </div>
  );
}
