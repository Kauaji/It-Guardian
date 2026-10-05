import { AlertTriangle, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { useRustdeskCountdown } from "../hooks/useRustdeskCountdown.js";
import RemoteWaitingState from "./RemoteWaitingState.jsx";

function RustdeskId({ credentials, onCopy }) {
  return (
    <div className="remote-assistance-rustdesk-id">
      <span className="label">Id RustDesk desta maquina</span>
      {credentials?.rustdeskId ? (
        <span className="value">
          {credentials.rustdeskId}
          <button type="button" className="icon-action" onClick={() => onCopy(credentials.rustdeskId, "Id")} title="Copiar id">
            <Copy size={14} />
          </button>
        </span>
      ) : (
        <span className="value muted">Nao relatado ainda pelo agente</span>
      )}
    </div>
  );
}

function RustdeskPassword({ credentials, secondsLeft, onCopy }) {
  return (
    <div className="remote-assistance-rustdesk-password">
      <span className="label">Senha desta sessao (expira em {secondsLeft}s)</span>
      <span className="value">
        {credentials.password}
        <button type="button" className="icon-action" onClick={() => onCopy(credentials.password, "Senha")} title="Copiar senha">
          <Copy size={14} />
        </button>
      </span>
    </div>
  );
}

/**
 * Painel do transporte RustDesk: substitui a tela/canvas do snapshot polling
 * e do WebRTC. Nao ha frame nem controle de mouse/teclado retransmitidos por
 * aqui -- a partir do momento em que o tecnico abre o cliente RustDesk
 * nativo, o IT Guardian perde visibilidade da sessao (ver docs/ASSISTENCIA-REMOTA.md).
 * A senha nunca aparece numa URL (nem no link rustdesk://, nem em lugar
 * nenhum copiavel automaticamente para o cliente): o tecnico sempre cola a
 * senha manualmente, para nao deixar rastro em historico de navegador ou
 * logs do sistema operacional.
 */
export default function RemoteRustdeskPanel({ session, credentials, revealing, error, onReveal, onCopy }) {
  const secondsLeft = useRustdeskCountdown(credentials?.expiresAt);
  const expired = secondsLeft === 0;

  return (
    <div className="remote-assistance-rustdesk-panel">
      {session.status === "waiting_consent" ? (
        <RemoteWaitingState icon={<RefreshCw size={24} className="spin" />} title="Aguardando resposta na maquina">
          A credencial de conexao so e emitida apos o usuario autorizar localmente.
        </RemoteWaitingState>
      ) : (
        <>
          <RustdeskId credentials={credentials} onCopy={onCopy} />

          {!credentials || expired ? (
            <button type="button" className="primary-action" onClick={onReveal} disabled={revealing}>
              {revealing ? <RefreshCw size={16} className="spin" /> : <KeyRound size={16} />}
              {expired ? "Gerar nova senha de sessao" : "Revelar senha de conexao"}
            </button>
          ) : (
            <RustdeskPassword credentials={credentials} secondsLeft={secondsLeft} onCopy={onCopy} />
          )}

          {credentials?.rustdeskId && (
            <a
              className="secondary-action"
              href={`rustdesk://${credentials.rustdeskId}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Abrir no cliente RustDesk
            </a>
          )}

          <div className="remote-assistance-rustdesk-warning">
            <AlertTriangle size={16} />
            <p>
              A senha nunca vai por link: cole-a manualmente no cliente RustDesk. Ela expira sozinha e
              nao pode ser reaproveitada. A partir da conexao no cliente nativo, esta janela deixa de
              acompanhar a tela ou os comandos da sessao -- encerre por aqui quando o atendimento terminar.
            </p>
          </div>
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
