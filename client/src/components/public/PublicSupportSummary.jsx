import { Send } from "lucide-react";

export default function PublicSupportSummary({ form, machine, loading, error, onBack, onConfirm }) {
  const machineLabel = form.machineScope === "mine" && machine?.id
    ? machine.name || machine.hostname
    : form.machineScope === "other"
      ? "outra máquina/equipamento (não vinculada automaticamente)"
      : "não vinculada";

  return (
    <section className="public-support-summary public-support-wide">
      <h2>Confira antes de enviar</h2>
      <dl>
        <dt>Solicitante</dt>
        <dd>{form.requesterName}</dd>
        <dt>Contato</dt>
        <dd>{form.contactInfo || form.extension || "Não informado"}</dd>
        <dt>Tipo de problema</dt>
        <dd>{form.problemType}</dd>
        <dt>Máquina</dt>
        <dd>{machineLabel}</dd>
        <dt>Setor/ambiente</dt>
        <dd>{form.department || form.environmentName || "Não informado"}</dd>
        <dt>Descrição</dt>
        <dd>{form.description}</dd>
      </dl>

      {error && <div className="public-support-error">{error}</div>}

      <div className="public-support-actions">
        <button type="button" className="ghost-action" onClick={onBack} disabled={loading}>
          Voltar e corrigir
        </button>
        <button type="button" className="primary-action" onClick={onConfirm} disabled={loading}>
          <Send size={18} />
          {loading ? "Enviando..." : "Enviar chamado"}
        </button>
      </div>
    </section>
  );
}
