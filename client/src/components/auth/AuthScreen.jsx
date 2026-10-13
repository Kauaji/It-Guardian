import { lazy, Suspense, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import AuthShell from "./AuthShell.jsx";
import CredentialsForm from "./CredentialsForm.jsx";
import MfaChallengeForm from "./MfaChallengeForm.jsx";

// "Esqueci minha senha" so carrega quando alguem clica (o bundle de entrada tem orcamento apertado).
const ForgotPasswordPanel = lazy(() => import("./ForgotPasswordPanel.jsx"));

const TITLES = { login: "Entrar", register: "Cadastro", forgot: "Recuperar senha" };

// Tela de acesso: login em 2 passos (credenciais -> codigo MFA, quando a conta
// tem verificacao em duas etapas), cadastro do primeiro administrador e recuperacao de senha.
export default function AuthScreen({ onAuth, notify }) {
  const useDemoCredentials = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [mode, setMode] = useState("login");
  useDocumentTitle(TITLES[mode]);
  const [challenge, setChallenge] = useState(null);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState(useDemoCredentials ? "admin@itguardian.local" : "");

  function authenticated(data, message) {
    onAuth(data);
    notify(message, "ok");
  }

  function startChallenge(next) {
    setEmail(next.email);
    setNotice("");
    setChallenge(next);
  }

  function leaveChallenge(message = "") {
    setNotice(message);
    setChallenge(null);
  }

  return (
    <AuthShell labelledBy={challenge ? "mfa-step-title" : undefined}>
      {challenge ? (
        <MfaChallengeForm
          mfaToken={challenge.mfaToken}
          email={challenge.email}
          onAuthenticated={authenticated}
          onBack={() => leaveChallenge()}
          onExpired={leaveChallenge}
        />
      ) : mode === "forgot" ? (
        <Suspense
          fallback={
            <p className="auth-step-text" role="status">
              Carregando...
            </p>
          }
        >
          <ForgotPasswordPanel initialEmail={email} onBack={() => setMode("login")} />
        </Suspense>
      ) : (
        <>
          <div className="segmented">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              aria-pressed={mode === "login"}
              onClick={() => setMode("login")}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Login
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              aria-pressed={mode === "register"}
              onClick={() => setMode("register")}
            >
              <UserPlus size={16} aria-hidden="true" />
              Cadastro
            </button>
          </div>
          <CredentialsForm
            key={mode}
            mode={mode}
            initialEmail={email}
            notice={notice}
            onAuthenticated={authenticated}
            onMfaRequired={startChallenge}
          />
          {mode === "login" && (
            <div className="auth-step-links">
              <button type="button" className="auth-link-button" onClick={() => setMode("forgot")}>
                Esqueci minha senha
              </button>
            </div>
          )}
        </>
      )}
    </AuthShell>
  );
}
