import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { login, register } from "../../api.js";

export default function AuthScreen({ onAuth, notify }) {
  const useDemoCredentials = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: useDemoCredentials ? "admin@itguardian.local" : "",
    password: useDemoCredentials ? "123456" : ""
  });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const action = mode === "login" ? login : register;
      const data = await action(form);
      onAuth(data);
      notify(mode === "login" ? "Login realizado com sucesso." : "Conta criada com sucesso.", "ok");
    } catch (error) {
      notify(error.statusCode === 401 ? "E-mail ou senha invalidos." : error.message, "danger");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-mark">
          <ShieldCheck size={34} />
          <div>
            <h1>IT Guardian</h1>
            <p>Monitoramento integrado de infraestrutura</p>
          </div>
        </div>

        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            <ShieldCheck size={16} />
            Login
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            <UserPlus size={16} />
            Cadastro
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Operador NOC"
              />
            </label>
          )}
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="admin@empresa.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="********"
            />
          </label>
          <button className="primary-action" disabled={loading}>
            {loading ? "Entrando..." : mode === "login" ? "Acessar painel" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}
