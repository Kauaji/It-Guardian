// Resumo da selecao herdada da aba Preventivas, exibido no topo do assistente.
export default function PreventiveAutomationContextSummary({ form, context }) {
  return (
    <section className="preventive-automation-context">
      <div>
        <span>Plano atual</span>
        <strong>{form.name || "Plano preventivo automatizado"}</strong>
      </div>
      <div>
        <span>Máquinas herdadas</span>
        <strong>{context.assetCount || 0}</strong>
        <small>{context.assetNames?.slice(0, 4).join(", ") || "Nenhuma máquina selecionada"}</small>
      </div>
      <div>
        <span>Verificações herdadas</span>
        <strong>{form.defaultScriptIds.length}</strong>
        <small>{context.scriptNames?.slice(0, 4).join(", ") || "Nenhum script selecionado"}</small>
      </div>
    </section>
  );
}
