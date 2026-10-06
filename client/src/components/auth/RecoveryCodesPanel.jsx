import { useState } from "react";
import { Copy, Download, TriangleAlert } from "lucide-react";
import { copyText, downloadTextFile } from "../../auth/clipboard.js";
import FormMessage from "./FormMessage.jsx";

// Codigos de recuperacao: o servidor so devolve o texto UMA vez (guarda o hash),
// entao esta e a unica chance de a pessoa guardar. Nada aqui persiste os codigos.
export default function RecoveryCodesPanel({ codes, acknowledged, onAcknowledgedChange }) {
  const [feedback, setFeedback] = useState({ tone: "info", text: "" });
  const text = codes.join("\n");

  async function copy() {
    const ok = await copyText(text);
    setFeedback(
      ok
        ? { tone: "info", text: "Códigos copiados. Cole em um gerenciador de senhas ou em um local seguro." }
        : { tone: "error", text: "Não foi possível copiar automaticamente. Selecione os códigos e copie manualmente." }
    );
  }

  function download() {
    downloadTextFile(
      "it-guardian-codigos-de-recuperacao.txt",
      `IT Guardian - códigos de recuperação\nCada código funciona uma única vez.\n\n${text}\n`
    );
    setFeedback({ tone: "info", text: "Arquivo baixado. Guarde-o fora deste computador." });
  }

  return (
    <div className="auth-recovery">
      <div className="auth-callout" role="note">
        <TriangleAlert size={18} aria-hidden="true" />
        <p>
          <strong>Estes códigos aparecem só agora.</strong> Se você perder o aplicativo autenticador, cada código permite um acesso.
          Guarde-os em local seguro; quem os tiver consegue entrar na sua conta.
        </p>
      </div>
      <ul className="auth-recovery-codes" aria-label="Códigos de recuperação">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <div className="auth-actions-row">
        <button type="button" className="secondary-action compact-action" onClick={copy}>
          <Copy size={16} aria-hidden="true" /> Copiar códigos
        </button>
        <button type="button" className="secondary-action compact-action" onClick={download}>
          <Download size={16} aria-hidden="true" /> Baixar .txt
        </button>
      </div>
      <FormMessage tone={feedback.tone}>{feedback.text}</FormMessage>
      <label className="auth-checkbox">
        <input type="checkbox" checked={acknowledged} onChange={(event) => onAcknowledgedChange(event.target.checked)} />
        <span>Guardei os códigos de recuperação em um local seguro.</span>
      </label>
    </div>
  );
}
