import { getRecurrenceLabel, getScopeLabel, normalizeAutomationColor } from "./preventiveAutomationPanelUtils.js";

// Revisao final do assistente (etapa 3), antes de gravar o plano automatizado.
export default function PreventiveAutomationReview({ form, wizardContext, scripts, scopeSources }) {
  const scriptNames = scripts.filter((script) => form.defaultScriptIds.includes(script.id)).map((script) => script.name);

  return (
    <section className="preventive-automation-review">
      <header>
        <div>
          <span>Revisão final</span>
          <h3>{form.name}</h3>
        </div>
        <span className="automation-color-dot" style={{ background: normalizeAutomationColor(form.indicatorColor) }} />
      </header>
      <dl>
        <div>
          <dt>Máquinas</dt>
          <dd>{wizardContext?.assetNames?.join(", ") || getScopeLabel(form, scopeSources)}</dd>
        </div>
        <div>
          <dt>Scripts</dt>
          <dd>{scriptNames.join(", ") || "Nenhum script selecionado"}</dd>
        </div>
        <div>
          <dt>Recorrência</dt>
          <dd>{getRecurrenceLabel(form)}</dd>
        </div>
        <div>
          <dt>Horário e fuso</dt>
          <dd>
            {form.preferredTime || "08:00"} - {form.timezone || "America/Sao_Paulo"}
          </dd>
        </div>
        <div>
          <dt>Escopo</dt>
          <dd>{getScopeLabel(form, scopeSources)}</dd>
        </div>
        <div>
          <dt>Cor</dt>
          <dd>{normalizeAutomationColor(form.indicatorColor)}</dd>
        </div>
        <div>
          <dt>Exceções</dt>
          <dd>{form.overrides.length ? `${form.overrides.length} recorrência(s) personalizada(s)` : "Sem exceções"}</dd>
        </div>
        <div>
          <dt>Observações</dt>
          <dd>{form.notes || form.description || "Sem observações"}</dd>
        </div>
      </dl>
    </section>
  );
}
