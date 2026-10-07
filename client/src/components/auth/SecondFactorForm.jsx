import { useEffect, useRef, useState } from "react";
import { describeIdentityError } from "../../auth/errorMessages.js";
import FormMessage from "./FormMessage.jsx";
import OneTimeCodeField from "./OneTimeCodeField.jsx";

// Reautenticacao para acoes sensiveis de MFA (desativar, regerar codigos): o
// servidor exige a SENHA e mais um segundo fator (codigo do app ou de recuperacao).
export default function SecondFactorForm({ title, description, submitLabel, danger = false, onSubmit, onCancel }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const factorRef = useRef(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const factor = useRecovery ? recoveryCode.trim() : code;
    if (!password) {
      setError("Informe sua senha.");
      passwordRef.current?.focus();
      return;
    }
    if (useRecovery ? !factor : factor.length !== 6) {
      setError(useRecovery ? "Informe um código de recuperação." : "Digite os 6 dígitos do código.");
      factorRef.current?.focus();
      return;
    }

    setError("");
    setLoading(true);
    try {
      await onSubmit(useRecovery ? { password, recoveryCode: factor } : { password, code: factor });
    } catch (failure) {
      setError(describeIdentityError(failure));
      setCode("");
      setRecoveryCode("");
      (failure.code === "CURRENT_PASSWORD_INVALID" ? passwordRef : factorRef).current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form auth-inline-form" noValidate aria-label={title}>
      <h4 className="auth-subtitle">{title}</h4>
      {description && <p className="auth-step-text">{description}</p>}
      <label>
        Senha
        <input
          ref={passwordRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {useRecovery ? (
        <label>
          Código de recuperação
          <input
            ref={factorRef}
            autoComplete="off"
            spellCheck={false}
            className="auth-code-input"
            placeholder="XXXXX-XXXXX"
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
          />
        </label>
      ) : (
        <OneTimeCodeField ref={factorRef} label="Código do aplicativo" value={code} onChange={setCode} />
      )}
      <button
        type="button"
        className="auth-link-button"
        onClick={() => {
          setUseRecovery((current) => !current);
          setError("");
        }}
      >
        {useRecovery ? "Usar código do aplicativo" : "Usar código de recuperação"}
      </button>
      <FormMessage>{error}</FormMessage>
      <div className="auth-actions-row">
        <button className={`${danger ? "danger-action" : "primary-action"} compact-action`} disabled={loading}>
          {loading ? "Aguarde..." : submitLabel}
        </button>
        <button type="button" className="ghost-action compact-action" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
