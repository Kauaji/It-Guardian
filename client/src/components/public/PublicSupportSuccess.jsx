import { useState } from "react";
import { CheckCircle, Copy, ShieldCheck } from "lucide-react";

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

export default function PublicSupportSuccess({ success, onReset }) {
  const [copied, setCopied] = useState(false);
  const trackingUrl = success.trackingToken
    ? `${window.location.origin}/chamado/${encodeURIComponent(success.trackingToken)}`
    : "";

  function copyTrackingLink() {
    if (!trackingUrl) return;
    navigator.clipboard
      ?.writeText(trackingUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {});
  }

  return (
    <main className="public-support-page">
      <section className="public-support-card public-support-success">
        <div className="public-support-brand">
          <ShieldCheck size={34} />
          <div>
            <strong>IT Guardian</strong>
            <span>Suporte técnico</span>
          </div>
        </div>
        <CheckCircle size={54} />
        <h1>Chamado aberto com sucesso</h1>
        <p>A equipe técnica recebeu o chamado e irá analisar as informações enviadas.</p>
        <div className="public-support-ticket">
          <span>Número da OS</span>
          <strong>{success.number}</strong>
        </div>
        <div className="public-support-meta">
          <span>Prioridade inicial: {priorityLabels[success.priority] || "Média"}</span>
          <span>{new Date(success.createdAt).toLocaleString("pt-BR")}</span>
        </div>
        <p className="public-support-tracking-hint">
          Guarde este número para acompanhamento: {success.number}.
        </p>
        {trackingUrl && (
          <div className="public-support-tracking">
            <p>O link abaixo permite consultar somente este chamado — status, título e data de abertura.</p>
            <button type="button" className="ghost-action" onClick={copyTrackingLink}>
              <Copy size={16} />
              {copied ? "Link copiado!" : "Copiar link de acompanhamento"}
            </button>
          </div>
        )}
        <button className="primary-action" onClick={onReset}>
          Abrir outra solicitação
        </button>
      </section>
    </main>
  );
}
