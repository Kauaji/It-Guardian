// Campo de comentario interno de um aviso (reutilizado nos avisos e no modal de sugestao).
export default function AlertCommentBox({ value, onChange, onSubmit }) {
  return (
    <div className="alert-comment-form">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Adicionar comentário interno"
        aria-label="Comentário interno"
      />
      <button type="button" className="secondary-action compact-action" onClick={onSubmit}>
        Comentar
      </button>
    </div>
  );
}
