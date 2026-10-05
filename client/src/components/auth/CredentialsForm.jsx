import { useEffect, useRef, useState } from "react";
import { login, register } from "../../api/identityApi.js";
import { describeIdentityError, identityMessages, weakPasswordDetails } from "../../auth/errorMessages.js";
import { validatePasswordLocally } from "../../auth/passwordPolicy.js";
import FormMessage from "./FormMessage.jsx";
import NewPasswordFields from "./NewPasswordFields.jsx";

function loginErrorMessage(error) {
  // 401 sem codigo (servidor antigo) continua significando credencial errada.
  if (!error.code && error.statusCode === 401) return identityMessages.INVALID_CREDENTIALS;
  return describeIdentityError(error, "Não foi possível entrar. Tente novamente.");
}

function registerErrors(error) {
  const details = weakPasswordDetails(error);
  return details.length ? details : [describeIdentityError(error, "Não foi possível criar a conta.")];
}

// Passo 1 do acesso: e-mail + senha (login) ou cadastro do primeiro admin.
// Login devolve a sessao ou `mfaRequired` (o pai abre o passo do codigo).
export default function CredentialsForm({ mode, initialEmail, notice, onAuthenticated, onMfaRequired }) {
  const [form, setForm] = useState({ name: "", email: initialEmail, password: "", setupToken: "" });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  const emailRef = useRef(null);
  const isLogin = mode === "login";

  useEffect(() => {
    // Ao voltar do passo do codigo (ou apos erro), o foco vai para o campo certo.
    (notice && initialEmail ? passwordRef : emailRef).current?.focus();
  }, [initialEmail, notice]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLogin() {
    const data = await login({ email: form.email.trim(), password: form.password });
    if (data.mfaRequired) {
      onMfaRequired({ mfaToken: data.mfaToken, email: form.email.trim() });
    } else {
      onAuthenticated(data, "Login realizado com sucesso.");
    }
  }

  async function submitRegister() {
    const local = validatePasswordLocally(form.password, { email: form.email, name: form.name });
    if (!local.valid) {
      setErrors(local.errors);
      passwordRef.current?.focus();
      return;
    }
    const data = await register({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      setupToken: form.setupToken.trim()
    });
    onAuthenticated(data, "Conta criada com sucesso.");
  }

  async function submit(event) {
    event.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      await (isLogin ? submitLogin() : submitRegister());
    } catch (error) {
      setErrors(isLogin ? [loginErrorMessage(error)] : registerErrors(error));
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form" noValidate>
      {notice && <FormMessage tone="info">{notice}</FormMessage>}
      {!isLogin && (
        <label>
          Nome
          <input
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Operador NOC"
          />
        </label>
      )}
      <label>
        E-mail
        <input
          ref={emailRef}
          type="email"
          autoComplete="username"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          placeholder="admin@empresa.com"
        />
      </label>
      {isLogin ? (
        <label>
          Senha
          <input
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder="********"
          />
        </label>
      ) : (
        <>
          <NewPasswordFields
            passwordLabel="Senha"
            passwordRef={passwordRef}
            password={form.password}
            onPasswordChange={(value) => update("password", value)}
          />
          <label>
            Token de configuração inicial (opcional)
            <input
              autoComplete="off"
              value={form.setupToken}
              onChange={(event) => update("setupToken", event.target.value)}
              placeholder="Exigido em produção"
            />
          </label>
        </>
      )}
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
        {loading ? (isLogin ? "Entrando..." : "Criando...") : isLogin ? "Acessar painel" : "Criar conta"}
      </button>
    </form>
  );
}
