import { Send } from "lucide-react";
import { useState } from "react";

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function ObservationTimeline({ observations, userName, onAdd }) {
  const [text, setText] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }

  return (
    <section className="observation-panel">
      <form onSubmit={submit} className="observation-form">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Adicionar observacao interna..."
        />
        <button className="primary-action compact-action" type="submit">
          <Send size={14} />
          Adicionar
        </button>
      </form>

      <div className="timeline-list">
        {observations.map((note) => (
          <article key={note.id} className="timeline-item">
            <time>{formatDateTime(note.createdAt)}</time>
            <strong>{note.user || userName}</strong>
            <p>{note.text}</p>
          </article>
        ))}
        {!observations.length && <p className="empty">Nenhuma observacao registrada.</p>}
      </div>
    </section>
  );
}
