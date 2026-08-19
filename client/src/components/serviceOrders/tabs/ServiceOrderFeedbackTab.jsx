import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { fetchServiceOrderFeedback, submitServiceOrderFeedback } from "../../../api.js";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="service-order-feedback-stars" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "filled" : ""}
          disabled={disabled || !onChange}
          onClick={() => onChange?.(star)}
          aria-label={`${star} estrela(s)`}
        >
          <Star size={18} fill={star <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export default function ServiceOrderFeedbackTab({ serviceOrderId, token, notify, canManage = true }) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!serviceOrderId || !token) return;
    setLoading(true);
    fetchServiceOrderFeedback(token, serviceOrderId)
      .then((response) => {
        setFeedback(response.feedback || null);
        setRating(response.feedback?.rating || 0);
        setComment(response.feedback?.comment || "");
      })
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [serviceOrderId, token, notify]);

  async function submit(event) {
    event.preventDefault();
    if (!rating) {
      notify?.("Selecione uma nota de 1 a 5.", "danger");
      return;
    }
    setSaving(true);
    try {
      const response = await submitServiceOrderFeedback(token, serviceOrderId, { rating, comment });
      setFeedback(response.feedback);
      notify?.("Avaliação registrada.", "success");
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="loading-message">Carregando avaliação...</p>;

  return (
    <section className="service-order-feedback-panel">
      {feedback && (
        <div className="service-order-feedback-current">
          <StarRating value={feedback.rating} />
          {feedback.comment && <p>{feedback.comment}</p>}
          <span>
            Registrada por {feedback.submittedByName || "Sistema"} em {formatDate(feedback.submittedAt)}
          </span>
        </div>
      )}

      {canManage && (
        <form className="service-order-feedback-form" onSubmit={submit}>
          <h4>{feedback ? "Atualizar avaliação" : "Registrar avaliação"}</h4>
          <StarRating value={rating} onChange={setRating} disabled={saving} />
          <textarea
            placeholder="Comentário (opcional)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={saving}
          />
          <button type="submit" className="primary-action compact-action" disabled={saving}>
            {saving ? "Salvando..." : "Salvar avaliação"}
          </button>
        </form>
      )}

      {!feedback && !canManage && <p className="empty">Nenhuma avaliação registrada para esta OS.</p>}
    </section>
  );
}
