// Mensagem de erro/aviso de formulario. `role="alert"` faz o leitor de tela
// anunciar assim que o texto aparece; `status` e para avisos nao urgentes.
export default function FormMessage({ tone = "error", children, id }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div id={id} role={tone === "error" ? "alert" : "status"} className={`auth-message auth-message-${tone}`}>
      {children}
    </div>
  );
}
