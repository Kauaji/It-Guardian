import { useRef, useState } from "react";
import { changePassword } from "../../api/identityApi.js";
import { describeIdentityError, weakPasswordDetails } from "../../auth/errorMessages.js";
import { validatePasswordLocally } from "../../auth/passwordPolicy.js";
import FormMessage from "./FormMessage.jsx";
import NewPasswordFields from "./NewPasswordFields.jsx";

const emptyForm = { currentPassword: "", newPassword: "", confirmation: "" };

// Formulario unico de troca de senha: usado na tela obrigatoria (bloqueante) e
// na pagina "Seguranca da conta". Em sucesso entrega a sessao NOVA do servidor
// (a troca revoga todas as outras sessoes) para o pai atualizar o app.
export default function ChangePasswordForm({ token, user, onChanged, submitLabel = "Trocar senha" }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentRef = useRef(null);
  const newRef = useRef(null);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function fail(messages, ref) {
    setErrors(messages);
    ref.current?.focus();
  }

  function validate() {
    if (!form.currentPassword) return [["Informe a senha atual."], currentRef];
    const local = validatePasswordLocally(form.newPassword, { email: user?.email, name: user?.name });
    if (!local.valid) return [local.errors, newRef];
    if (form.newPassword === form.currentPassword) return [["A nova senha precisa ser diferente da atual."], newRef];
    if (form.newPassword !== form.confirmation) return [["A confirmação não é igual à nova senha."], newRef];
    return null;
  }

  async function submit(event) {
    event.preventDefault();
    setErrors([]);
    const invalid = validate();
    if (invalid) {
      fail(...invalid);
      return;
    }

    setLoading(true);
    try {
      const session = await changePassword(token, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setForm(emptyForm);
      await onChanged(session);
    } catch (error) {
      const details = weakPasswordDetails(error);
      const wrongCurrent = error.code === "CURRENT_PASSWORD_INVALID";
      fail(details.length ? details : [describeIdentityError(error)], wrongCurrent ? currentRef : newRef);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form" noValidate aria-label="Trocar senha">
      {/* Gerenciadores de senha usam o e-mail para associar a nova senha ao login certo. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={user?.email || ""}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="auth-sr-only"
      />
      <label>
        Senha atual
        <input
          ref={currentRef}
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(event) => update("currentPassword", event.target.value)}
        />
      </label>
      <NewPasswordFields
        passwordRef={newRef}
        password={form.newPassword}
        onPasswordChange={(value) => update("newPassword", value)}
        confirmation={form.confirmation}
        onConfirmationChange={(value) => update("confirmation", value)}
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
        {loading ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
