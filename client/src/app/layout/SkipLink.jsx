export const MAIN_CONTENT_ID = "conteudo-principal";

// Primeiro item focavel da pagina: leva direto ao conteudo, pulando a sidebar e a barra superior.
// Fica fora da tela ate receber foco (ver .skip-link em runtime-recovery-a11y.css).
export default function SkipLink() {
  function handleClick(event) {
    const target = document.getElementById(MAIN_CONTENT_ID);
    if (!target) return;
    // Foca o <main> sem depender de hash na URL (o app usa o roteador do navegador).
    event.preventDefault();
    target.focus();
    target.scrollIntoView?.({ block: "start" });
  }

  return (
    <a className="skip-link" href={`#${MAIN_CONTENT_ID}`} onClick={handleClick}>
      Pular para o conteúdo
    </a>
  );
}
