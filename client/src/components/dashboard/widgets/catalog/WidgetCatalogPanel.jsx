import { Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDashboardWidgetCatalog } from "../../../../api.js";
import { useModalLifecycle } from "../../../../hooks/useModalLifecycle.js";
import WidgetPreview from "../WidgetPreview.jsx";
import { resolveVisualization, visualizationLabels, widgetVisualizations } from "../widgetVisualizations.js";

const categoryLabels = {
  overview: "Visão geral", assets: "Ativos", metrics: "Métricas",
  service_orders: "Ordens de serviço", alerts: "Avisos", events: "Eventos e scripts"
};

function CatalogWidgetCard({ item, onAddWidget, disabled }) {
  const [chartType, setChartType] = useState(() => resolveVisualization(item.type));
  const variants = widgetVisualizations(item.type);
  return (
    <article className="dashboard-widget-catalog-card" aria-label={item.label}>
      <div className="dashboard-catalog-card-heading"><h4>{item.label}</h4><small>{item.requiresAssetConfig ? "Por ativo · configuração individual" : "Dados do ambiente · filtros cruzados"}</small></div>
      <WidgetPreview variant={chartType} />
      <div className="dashboard-catalog-card-actions">
        <label><span className="sr-only">{"Visualização de " + item.label}</span>
          <select aria-label={"Visualização de " + item.label} value={chartType} onChange={(event) => setChartType(event.target.value)} disabled={variants.length === 1}>
            {variants.map((variant) => <option key={variant} value={variant}>{visualizationLabels[variant]}</option>)}
          </select>
        </label>
        <button type="button" className="dashboard-catalog-add" disabled={disabled} aria-label={"Adicionar " + item.label} onClick={() => onAddWidget({ ...item, config: { chartType } })}><Plus size={15} /> Adicionar</button>
      </div>
    </article>
  );
}

export default function WidgetCatalogPanel({ token, open, onClose, onAddWidget, remainingSlots = 30 }) {
  const dialogRef = useModalLifecycle(open, onClose);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchDashboardWidgetCatalog(token)
      .then((result) => {
        if (!cancelled) {
          setCatalog(Array.isArray(result.widgets) ? result.widgets : []);
          setError("");
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Não foi possível carregar o catálogo.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, token]);

  if (!open) return null;
  const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = catalog.filter((item) => (!category || item.category === category) && normalize(item.label).includes(normalize(query)));
  const grouped = filtered.reduce((acc, item) => {
    (acc[item.category || "outros"] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="modal-panel dashboard-widget-catalog-panel" role="dialog" aria-modal="true" aria-label="Adicionar widget">
        <header>
          <div><h2>Adicionar widget</h2><p>Escolha o dado e a melhor forma de visualizá-lo.</p></div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar"><X size={18} /></button>
        </header>
        <div className="dashboard-catalog-tools">
          <label className="dashboard-catalog-search"><Search size={16} /><input type="search" aria-label="Buscar widget" placeholder="Buscar widget…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select aria-label="Categoria dos widgets" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas as categorias</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <p className="dashboard-catalog-note">As miniaturas são ilustrativas. Ao adicionar, o widget usa os dados reais do seu ambiente.</p>
        {remainingSlots === 0 && <p className="form-error" role="status">Limite de 30 widgets atingido. Remova um widget para adicionar outro.</p>}
        <div className="dashboard-catalog-results">
          {loading ? <p className="dashboard-empty-state">Carregando catálogo…</p> : error ? <p className="form-error" role="alert">{error}</p> : filtered.length === 0 ? <p className="dashboard-empty-state">Nenhum widget encontrado.</p> : Object.entries(grouped).map(([group, items]) => (
            <section key={group} className="dashboard-widget-catalog-group">
              <h3>{categoryLabels[group] || group}<span>{items.length}</span></h3>
              <div className="dashboard-widget-catalog-grid">{items.map((item) => <CatalogWidgetCard key={item.type} item={item} onAddWidget={onAddWidget} disabled={remainingSlots === 0} />)}</div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
