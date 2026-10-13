import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { resetPassword } from "../../api/passwordRecoveryApi.js";
import { describeIdentityError, weakPasswordDetails } from "../../auth/errorMessages.js";
import { validatePasswordLocally } from "../../auth/passwordPolicy.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import { LOGIN_PATH } from "../../app/routes.js";
import AuthShell from "./AuthShell.jsx";
import FormMessage from "./FormMessage.jsx";
import NewPasswordFields from "./NewPasswordFields.jsx";

// Formato que o servidor gera (32 bytes em base64url). Filtro so de interface: quem decide e o servidor.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Le o token do fragmento (#token=...) e o tira da barra de enderecos (historico, capturas de tela). */
function takeTokenFromUrl() {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
  if (window.location.hash) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }
  return TOKEN_PATTERN.test(token) ? token : "";
}

// Pagina publica aberta pelo link do e-mail. Nao abre sessao: depois de trocar a
// senha a pessoa entra normalmente (e passa pelo MFA, se tiver).
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [form, setForm] = useState({ password: "", confirmation: "" });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const titleRef = useRef(null);
  const passwordRef = useRef(null);
  useDocumentTitle("Redefinir senha");

  useEffect(() => {
    const found = takeTokenFromUrl();
    setToken(found);
    setInvalid(!found);
  }, []);

  useEffect(() => {
    if (token === null) return;
    (invalid || done ? titleRef : passwordRef).current?.focus();
  }, [token, invalid, done]);

  function fail(messages) {
    setErrors(messages);
    passwordRef.current?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    setErrors([]);
    const local = validatePasswordLocally(form.password, {});
    if (!local.valid) return fail(local.errors);
    if (form.password !== form.confirmation) return fail(["A confirmação não é igual à nova senha."]);

    setLoading(true);
    try {
      await resetPassword(token, form.password);
      setForm({ password: "", confirmation: "" });
      setDone(true);
    } catch (failure) {
      if (failure.code === "RESET_TOKEN_INVALID") {
        setInvalid(true);
      } else {
        const details = weakPasswordDetails(failure);
        fail(details.length ? details : [describeIdentityError(failure)]);
      }
    } finally {
      setLoading(false);
    }
  }

  if (token === null) return null;

  if (invalid) {
    return (
      <AuthShell labelledBy="reset-title">
        <div className="auth-step">
          <h2 id="reset-title" className="auth-step-title" tabIndex={-1} ref={titleRef}>
            <LinkIcon size={20} aria-hidden="true" /> Link inválido
          </h2>
          <p className="auth-step-text">Este link de redefinição é inválido ou expirou. Peça um novo link na tela de login.</p>
          <button type="button" className="primary-action" onClick={() => navigate(LOGIN_PATH)}>
            Pedir um novo link
          </button>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell labelledBy="reset-title">
        <div className="auth-step">
          <h2 id="reset-title" className="auth-step-title" tabIndex={-1} ref={titleRef}>
            <CheckCircle2 size={20} aria-hidden="true" /> Senha alterada
          </h2>
          <p className="auth-step-text">
            Pronto! Agora entre com a nova senha. Todos os dispositivos foram desconectados. Se você usa verificação em duas etapas, ela
            continua ativa.
          </p>
          <button type="button" className="primary-action" onClick={() => navigate(LOGIN_PATH)}>
            Ir para o login
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell labelledBy="reset-title">
      <div className="auth-step">
        <h2 id="reset-title" className="auth-step-title">
          Escolha uma nova senha
        </h2>
        <form onSubmit={submit} className="auth-form" noValidate aria-labelledby="reset-title">
          <NewPasswordFields
            passwordRef={passwordRef}
            password={form.password}
            onPasswordChange={(value) => setForm((current) => ({ ...current, password: value }))}
            confirmation={form.confirmation}
            onConfirmationChange={(value) => setForm((current) => ({ ...current, confirmation: value }))}
          />
          <FormMessage>
            {errors.length > 1 ? (
              <ul>
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              errors[0]
            )}
          </FormMessage>
          <button className="primary-action" disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
