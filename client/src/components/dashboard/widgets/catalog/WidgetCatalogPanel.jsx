import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDashboardWidgetCatalog } from "../../../../api.js";
import { useModalLifecycle } from "../../../../hooks/useModalLifecycle.js";

const categoryLabels = {
  overview: "Visao geral",
  assets: "Ativos",
  metrics: "Metricas",
  service_orders: "Ordens de servico",
  alerts: "Avisos",
  events: "Eventos e scripts"
};

export default function WidgetCatalogPanel({ token, open, onClose, onAddWidget }) {
  const dialogRef = useModalLifecycle(open, onClose);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        if (!cancelled) setError(fetchError.message || "Nao foi possivel carregar o catalogo de widgets.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  if (!open) return null;

  const grouped = catalog.reduce((acc, item) => {
    const key = item.category || "outros";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} className="modal-panel dashboard-widget-catalog-panel" role="dialog" aria-modal="true" aria-label="Adicionar widget">
        <header>
          <h2>Adicionar widget</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        {loading ? (
          <p className="dashboard-empty-state">Carregando catalogo...</p>
        ) : error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <section key={category} className="dashboard-widget-catalog-group">
              <h3>{categoryLabels[category] || category}</h3>
              <div className="dashboard-widget-catalog-grid">
                {items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className="dashboard-widget-catalog-card"
                    onClick={() => onAddWidget(item)}
                  >
                    <span>{item.label}</span>
                    <Plus size={16} />
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
