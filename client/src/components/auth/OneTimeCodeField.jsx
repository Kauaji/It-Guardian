import { forwardRef } from "react";

export function sanitizeOneTimeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

// Campo do codigo TOTP de 6 digitos: teclado numerico no celular e sugestao
// do codigo recebido por SMS/gerenciador (`one-time-code`).
const OneTimeCodeField = forwardRef(function OneTimeCodeField(
  { label = "Código de 6 dígitos", value, onChange, describedBy, disabled },
  ref
) {
  return (
    <label>
      {label}
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        placeholder="000000"
        className="auth-code-input"
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(sanitizeOneTimeCode(event.target.value))}
      />
    </label>
  );
});

export default OneTimeCodeField;
