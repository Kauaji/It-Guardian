import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, ShieldCheck } from "lucide-react";
import { fetchPublicServiceOrderTracking } from "../../api.js";

const statusLabels = {
  open: "Aberta",
  in_progress: "Em atendimento",
  waiting: "Aguardando",
  closed: "Finalizada"
};

const priorityLabels = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

const slaLabels = {
  on_track: "Dentro do prazo",
  near_due: "Prazo próximo do vencimento",
  breached: "Prazo vencido",
  resolved: "Concluída dentro do prazo",
  not_applicable: "Sem prazo aplicável"
};

function formatDate(value) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleString("pt-BR");
}

export default function PublicServiceOrderTracking({ token }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchPublicServiceOrderTracking(token)
      .then((response) => {
        if (active) setTracking(response.tracking);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Não foi possível localizar este chamado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="public-support-page">
      <section className="public-support-card">
        <div className="public-support-brand">
          <ShieldCheck size={34} />
          <div>
            <strong>IT Guardian</strong>
            <span>Acompanhamento de chamado</span>
          </div>
        </div>

        {loading && <p className="public-support-machine-status">Carregando chamado...</p>}

        {!loading && error && (
          <p className="public-support-machine-status public-support-machine-status-warning">
            <AlertTriangle size={18} />
            {error}
          </p>
        )}

        {!loading && !error && tracking && (
          <div className="public-support-tracking-details">
            <div className="public-support-ticket">
              <span>Número da OS</span>
              <strong>{tracking.number}</strong>
            </div>
            <dl>
              <dt>Título</dt>
              <dd>{tracking.title}</dd>
              <dt>Status</dt>
              <dd>
                <ClipboardList size={14} /> {statusLabels[tracking.status] || tracking.status}
              </dd>
              <dt>Prioridade</dt>
              <dd>{priorityLabels[tracking.priority] || tracking.priority}</dd>
              <dt>Aberta em</dt>
              <dd>{formatDate(tracking.createdAt)}</dd>
              <dt>Última atualização</dt>
              <dd>{formatDate(tracking.updatedAt)}</dd>
              {tracking.sla?.status && tracking.sla.status !== "not_applicable" && (
                <>
                  <dt>Previsão</dt>
                  <dd>{slaLabels[tracking.sla.status] || tracking.sla.status}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
