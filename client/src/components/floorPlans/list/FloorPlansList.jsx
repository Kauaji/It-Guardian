import { useMemo } from "react";
import { Copy, Layers3, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { formatDate, planStatusLabel } from "../utils/planPresentation.js";

function filterPlans(plans, query) {
  const term = query.trim().toLowerCase();
  if (!term) return plans;
  return plans.filter((plan) => {
    return [plan.name, plan.company, plan.unit, plan.floorLabel, plan.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });
}

function FloorPlanCard({ plan, permissions, onOpen, onDuplicate, onDelete }) {
  return (
    <article className="floor-plan-card">
      <header>
        <span className={`floor-plan-status ${plan.status || "draft"}`}>{planStatusLabel(plan.status)}</span>
        <button className="icon-button" type="button" onClick={() => onOpen(plan.id)} title="Abrir planta">
          <Layers3 size={18} />
        </button>
      </header>
      <h3>{plan.name}</h3>
      <p>{[plan.company, plan.unit, plan.floorLabel].filter(Boolean).join(" - ") || "Sem local definido"}</p>
      <dl>
        <div>
          <dt>Ativos</dt>
          <dd>{plan.assetCount || 0}</dd>
        </div>
        <div>
          <dt>Objetos</dt>
          <dd>{plan.objectCount || 0}</dd>
        </div>
        <div>
          <dt>Andares</dt>
          <dd>{plan.floorCount || 0}</dd>
        </div>
        <div>
          <dt>Atualizada</dt>
          <dd>{formatDate(plan.updatedAt)}</dd>
        </div>
      </dl>
      <footer>
        <button className="secondary-action compact-action" type="button" onClick={() => onOpen(plan.id)}>
          Abrir
        </button>
        {permissions.create && (
          <button className="icon-button" type="button" onClick={() => onDuplicate(plan.id)} title="Duplicar planta">
            <Copy size={17} />
          </button>
        )}
        {permissions.delete && (
          <button className="icon-button danger-icon" type="button" onClick={() => onDelete(plan)} title="Excluir planta">
            <Trash2 size={17} />
          </button>
        )}
      </footer>
    </article>
  );
}

export default function FloorPlansList({ plans, loading, query, onQueryChange, onCreate, onOpen, onDuplicate, onDelete, permissions }) {
  const filteredPlans = useMemo(() => filterPlans(plans, query), [plans, query]);

  return (
    <section className="floor-plans-view">
      <header className="floor-plans-header">
        <div>
          <span className="eyebrow">Plantas</span>
          <h2>Plantas e Infraestrutura</h2>
          <p>Mapeie ambientes, ativos, pontos, cabos e zonas com vinculo ao inventario.</p>
        </div>
        {permissions.create && (
          <button className="primary-action compact-action" type="button" onClick={onCreate}>
            <Plus size={18} />
            Nova planta
          </button>
        )}
      </header>

      <div className="floor-plans-toolbar">
        <label className="compact-search floor-plan-search">
          <Search size={18} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar planta, empresa, andar ou status" />
        </label>
      </div>

      {loading && (
        <div className="floor-plan-loading">
          <Loader2 size={18} />
          Carregando plantas...
        </div>
      )}

      {!loading && filteredPlans.length === 0 && (
        <div className="floor-plan-list-empty">
          <strong>Nenhuma planta cadastrada.</strong>
          <span>Crie a primeira planta para organizar infraestrutura fisica e logica.</span>
        </div>
      )}

      <div className="floor-plan-list-grid">
        {filteredPlans.map((plan) => (
          <FloorPlanCard key={plan.id} plan={plan} permissions={permissions} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
