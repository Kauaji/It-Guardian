import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import PreventiveScriptOption from "./PreventiveScriptOption.jsx";

function ScriptList({ preventive }) {
  const { perms } = useAlertCenterView();
  const { selection, recommendations, orderedScripts } = preventive;

  return (
    <section className="preventive-script-list">
      <div>
        <h4>Verificações selecionáveis</h4>
        <p>{recommendations.recommended?.length ? "Recomendações aparecem primeiro." : "Selecione máquinas para melhorar as recomendações."}</p>
      </div>
      {recommendations.loading && <p className="empty">Carregando recomendações...</p>}
      {recommendations.error && <p className="empty">{recommendations.error}</p>}
      {orderedScripts.map((script) => (
        <PreventiveScriptOption
          key={script.id}
          script={script}
          selected={selection.scripts.has(script.id)}
          expanded={selection.expandedScripts.has(script.id)}
          disabled={!perms.canCreatePreventivePlans}
          onToggle={selection.toggleScript}
          onToggleDetails={selection.toggleScriptDetails}
        />
      ))}
      {!orderedScripts.length && (
        <p className="empty">Nenhuma verificação/script ativo cadastrado.</p>
      )}
    </section>
  );
}

function BuilderActions({ preventive }) {
  const { perms } = useAlertCenterView();
  const { selection, saving } = preventive;
  const noSelection = !selection.assets.size || !selection.scripts.size;

  return (
    <div className="preventive-plan-actions">
      {perms.canViewPreventiveAutomation && (
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={!perms.canCreatePreventiveAutomation || noSelection}
          onClick={preventive.openAutomationFromSelection}
        >
          Automatizar
        </button>
      )}
      <button
        type="button"
        className="primary-action compact-action"
        disabled={!perms.canCreatePreventivePlans || saving || noSelection}
        onClick={preventive.openReview}
      >
        {saving ? "Registrando..." : "Revisar preventiva"}
      </button>
    </div>
  );
}

// Etapa 2: nome do plano, verificacoes/scripts e acoes (automatizar ou revisar).
export default function PreventivePlanBuilder({ preventive }) {
  const { perms } = useAlertCenterView();

  return (
    <aside className="preventive-plan-builder ready" aria-label="Criar plano preventivo">
      <header>
        <span className="preventive-step-pill">Etapa 2</span>
        <h3>Selecionar verificações/scripts</h3>
      </header>

      <label>
        Nome do plano
        <input
          value={preventive.planName}
          disabled={!perms.canCreatePreventivePlans}
          onChange={(event) => preventive.setPlanName(event.target.value)}
        />
      </label>

      <ScriptList preventive={preventive} />

      <div className="preventive-plan-summary-card">
        <span>{preventive.selection.assets.size} máquina(s)</span>
        <span>{preventive.selectedScripts.length} verificação(ões)</span>
      </div>

      <BuilderActions preventive={preventive} />
    </aside>
  );
}
