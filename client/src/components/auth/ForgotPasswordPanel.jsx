import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { fetchAuthOptions, requestPasswordReset } from "../../api/passwordRecoveryApi.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import FormMessage from "./FormMessage.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Esqueci minha senha": pede o link por e-mail. A confirmacao e SEMPRE a mesma
// (existindo ou nao a conta), igual a resposta do servidor. Se o servidor nao
// tem e-mail configurado, orienta pedir a redefinicao a um administrador.
export default function ForgotPasswordPanel({ initialEmail = "", onBack }) {
  const [available, setAvailable] = useState(null);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const titleRef = useRef(null);
  const emailRef = useRef(null);
  useDocumentTitle("Recuperar senha");

  useEffect(() => {
    let active = true;
    // Sem resposta das opcoes (rede/servidor antigo) ainda oferecemos o formulario: o servidor decide.
    Promise.resolve(fetchAuthOptions())
      .then((options) => active && setAvailable(options?.passwordReset?.enabled !== false))
      .catch(() => active && setAvailable(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    (sent || available === false ? titleRef : emailRef).current?.focus();
  }, [available, sent]);

  async function submit(event) {
    event.preventDefault();
    const clean = email.trim();
    if (!EMAIL_PATTERN.test(clean)) {
      setError("Informe um e-mail válido.");
      emailRef.current?.focus();
      return;
    }
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(clean);
      setSent(true);
    } catch (failure) {
      setError(describeIdentityError(failure, "Não foi possível enviar o pedido. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  const backButton = (label) => (
    <button type="button" className="auth-link-button" onClick={onBack}>
      <ArrowLeft size={14} aria-hidden="true" /> {label}
    </button>
  );

  if (available === null) {
    return (
      <p className="auth-step-text" role="status">
        Carregando...
      </p>
    );
  }

  if (available === false) {
    return (
      <div className="auth-step">
        <h2 className="auth-step-title" tabIndex={-1} ref={titleRef}>
          Recuperar senha
        </h2>
        <p className="auth-step-text">
          A recuperação por e-mail não está disponível neste servidor. Peça a um administrador para redefinir a sua senha.
        </p>
        <div className="auth-step-links">{backButton("Voltar ao login")}</div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="auth-step">
        <h2 className="auth-step-title" tabIndex={-1} ref={titleRef}>
          <MailCheck size={20} aria-hidden="true" /> Verifique seu e-mail
        </h2>
        <p className="auth-step-text">
          Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por pouco tempo e só pode ser usado uma vez.
        </p>
        <p className="auth-step-text">Não chegou? Veja a pasta de spam ou aguarde alguns minutos antes de pedir de novo.</p>
        <div className="auth-step-links">{backButton("Voltar ao login")}</div>
      </div>
    );
  }

  return (
    <div className="auth-step">
      <h2 className="auth-step-title" tabIndex={-1} ref={titleRef}>
        Recuperar senha
      </h2>
      <p className="auth-step-text">Informe o e-mail da sua conta. Enviaremos um link para você escolher uma nova senha.</p>
      <form onSubmit={submit} className="auth-form" noValidate>
        <label>
          E-mail
          <input
            ref={emailRef}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
        </label>
        <FormMessage>{error}</FormMessage>
        <button className="primary-action" disabled={loading}>
          {loading ? "Enviando..." : "Enviar link de redefinição"}
        </button>
      </form>
      <div className="auth-step-links">{backButton("Voltar")}</div>
    </div>
  );
}
