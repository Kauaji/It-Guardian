import { useId } from "react";
import { Check, Circle } from "lucide-react";
import { passwordChecklist, passwordStrength } from "../../auth/passwordPolicy.js";

// Campos "nova senha" (+ confirmacao opcional) com checklist e forca. O
// checklist so reflete as regras que o cliente consegue conferir sozinho; o
// servidor valida o resto (senhas comuns, nome/e-mail) e o erro dele aparece
// no formulario que usa este componente.
export default function NewPasswordFields({
  password,
  onPasswordChange,
  confirmation,
  onConfirmationChange,
  passwordRef,
  disabled = false,
  passwordLabel = "Nova senha",
  confirmationLabel = "Confirmar nova senha"
}) {
  const hintId = useId();
  const mismatchId = useId();
  const checklist = passwordChecklist(password);
  const strength = passwordStrength(password);
  const hasConfirmation = typeof onConfirmationChange === "function";
  const mismatch = hasConfirmation && confirmation.length > 0 && confirmation !== password;

  return (
    <>
      <label>
        {passwordLabel}
        <input
          ref={passwordRef}
          type="password"
          autoComplete="new-password"
          value={password}
          disabled={disabled}
          aria-describedby={hintId}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </label>
      <div id={hintId} className="auth-hint">
        <ul className="auth-checklist" aria-label="Requisitos da senha">
          {checklist.map((item) => (
            <li key={item.id} className={item.met ? "met" : ""}>
              {item.met ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span>{item.label}</span>
              <span className="auth-sr-only">{item.met ? " (atendido)" : " (pendente)"}</span>
            </li>
          ))}
        </ul>
        {password.length > 0 && (
          <div className="auth-strength">
            <div
              role="meter"
              aria-label="Força da senha"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={strength.score}
              aria-valuetext={strength.label}
              className={`auth-strength-bar level-${strength.score}`}
            >
              <span />
            </div>
            <small>Força: {strength.label}</small>
          </div>
        )}
        <small>Dica: uma frase longa é mais segura e mais fácil de lembrar do que símbolos.</small>
      </div>
      {hasConfirmation && (
        <label>
          {confirmationLabel}
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            disabled={disabled}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? mismatchId : undefined}
            onChange={(event) => onConfirmationChange(event.target.value)}
          />
        </label>
      )}
      {mismatch && (
        <p id={mismatchId} className="auth-field-error" role="status">
          As senhas não coincidem.
        </p>
      )}
    </>
  );
}
