import { useCallback, useEffect, useState } from "react";
import { Laptop } from "lucide-react";
import { fetchSessions, revokeOtherSessions, revokeSession } from "../../api/identityApi.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import { describeDevice, formatDateTime } from "../../auth/userAgent.js";
import FormMessage from "./FormMessage.jsx";

// Sessoes ativas da conta. A atual aparece marcada e nao tem "Encerrar" (para
// sair daqui existe o botao Sair); as demais podem ser encerradas uma a uma
// ou todas de uma vez. `reloadKey` forca nova leitura (ex.: apos trocar a senha).
export default function SessionsSection({ token, notify, reloadKey = 0 }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await fetchSessions(token));
      setError("");
    } catch (failure) {
      setError(describeIdentityError(failure, "Não foi possível carregar as sessões."));
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  async function run(action, successMessage) {
    setBusy(true);
    let failure = "";
    try {
      await action();
      notify(successMessage, "ok");
    } catch (cause) {
      // 404: a sessao ja tinha acabado; a lista recarregada mostra o estado real.
      if (cause.statusCode !== 404) failure = describeIdentityError(cause);
    } finally {
      await load();
      // A recarga limpa o erro da lista; o da acao precisa sobreviver a ela.
      if (failure) setError(failure);
      setBusy(false);
    }
  }

  const others = (sessions || []).filter((session) => !session.current);

  return (
    <section className="account-section" aria-labelledby="sessions-section-title">
      <h3 id="sessions-section-title">Sessões ativas</h3>
      <p className="auth-step-text">
        Dispositivos com acesso à sua conta. Encerre os que você não reconhece e, se suspeitar de algo, troque a senha.
      </p>
      <FormMessage>{error}</FormMessage>
      {sessions && (
        <ul className="account-sessions" aria-label="Sessões ativas">
          {sessions.map((session) => (
            <li key={session.id} className={session.current ? "current" : ""}>
              <Laptop size={20} aria-hidden="true" />
              <div className="account-session-info">
                <strong>
                  {describeDevice(session.userAgent)}
                  {session.current && <span className="admin-badge accent">Esta sessão</span>}
                </strong>
                <small>
                  IP {session.ip || "desconhecido"} · último uso {formatDateTime(session.lastSeenAt)} · iniciada em{" "}
                  {formatDateTime(session.createdAt)}
                </small>
              </div>
              {!session.current && (
                <button
                  type="button"
                  className="secondary-action compact-action"
                  disabled={busy}
                  aria-label={`Encerrar sessão de ${describeDevice(session.userAgent)} (${session.ip || "IP desconhecido"})`}
                  onClick={() => run(() => revokeSession(token, session.id), "Sessão encerrada.")}
                >
                  Encerrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="auth-actions-row">
        <button
          type="button"
          className="danger-action compact-action"
          disabled={busy || others.length === 0}
          onClick={() => run(() => revokeOtherSessions(token), "Outras sessões encerradas.")}
        >
          Encerrar todas as outras
        </button>
      </div>
    </section>
  );
}
