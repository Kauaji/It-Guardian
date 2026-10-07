import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loginMfa } from "../../api/identityApi.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import FormMessage from "./FormMessage.jsx";
import OneTimeCodeField from "./OneTimeCodeField.jsx";

// Passo 2 do login: codigo TOTP de 6 digitos (ou codigo de recuperacao).
export default function MfaChallengeForm({ mfaToken, email, onAuthenticated, onBack, onExpired }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [useRecovery]);

  function switchMethod() {
    setUseRecovery((current) => !current);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    const value = useRecovery ? recoveryCode.trim() : code;
    if (useRecovery ? !value : value.length !== 6) {
      setError(useRecovery ? "Informe um código de recuperação." : "Digite os 6 dígitos do código.");
      inputRef.current?.focus();
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await loginMfa(useRecovery ? { mfaToken, recoveryCode: value } : { mfaToken, code: value });
      onAuthenticated(data, "Login realizado com sucesso.");
    } catch (failure) {
      if (failure.code === "MFA_CHALLENGE_INVALID") {
        onExpired(describeIdentityError(failure));
        return;
      }
      setError(describeIdentityError(failure, "Não foi possível verificar o código. Tente novamente."));
      setCode("");
      setRecoveryCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form auth-step" noValidate>
      <div>
        <h2 id="mfa-step-title" className="auth-step-title" tabIndex={-1}>
          Verificação em duas etapas
        </h2>
        <p className="auth-step-text" id="mfa-step-help">
          {useRecovery
            ? "Digite um dos códigos de recuperação que você guardou. Cada código só funciona uma vez."
            : `Digite o código de 6 dígitos do aplicativo autenticador para entrar como ${email}.`}
        </p>
      </div>

      {useRecovery ? (
        <label>
          Código de recuperação
          <input
            ref={inputRef}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXXX-XXXXX"
            className="auth-code-input"
            value={recoveryCode}
            aria-describedby="mfa-step-help"
            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
          />
        </label>
      ) : (
        <OneTimeCodeField ref={inputRef} value={code} onChange={setCode} describedBy="mfa-step-help" />
      )}

      <FormMessage>{error}</FormMessage>

      <button className="primary-action" disabled={loading}>
        {loading ? "Verificando..." : "Verificar"}
      </button>
      <div className="auth-step-links">
        <button type="button" className="auth-link-button" onClick={switchMethod}>
          {useRecovery ? "Usar código do aplicativo" : "Usar código de recuperação"}
        </button>
        <button type="button" className="auth-link-button" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" /> Voltar
        </button>
      </div>
    </form>
  );
}
