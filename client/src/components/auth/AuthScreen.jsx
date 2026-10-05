import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import AuthShell from "./AuthShell.jsx";
import CredentialsForm from "./CredentialsForm.jsx";
import MfaChallengeForm from "./MfaChallengeForm.jsx";

// Tela de acesso: login em 2 passos (credenciais -> codigo MFA, quando a conta
// tem verificacao em duas etapas) e cadastro do primeiro administrador.
export default function AuthScreen({ onAuth, notify }) {
  const useDemoCredentials = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [mode, setMode] = useState("login");
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
      ) : (
        <>
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => setMode("login")}>
              <ShieldCheck size={16} aria-hidden="true" />
              Login
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} aria-pressed={mode === "register"} onClick={() => setMode("register")}>
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
        </>
      )}
    </AuthShell>
  );
}
