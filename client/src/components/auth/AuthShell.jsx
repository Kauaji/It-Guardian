import { ShieldCheck } from "lucide-react";
import "./auth.css";

// Moldura de tela cheia (mesma do login) para as telas de identidade que nao
// vivem dentro do app: login, troca de senha obrigatoria e cadastro de MFA.
export default function AuthShell({ children, wide = false, labelledBy }) {
  return (
    <main className="auth-shell">
      <section className={`auth-panel${wide ? " auth-panel-wide" : ""}`} aria-labelledby={labelledBy}>
        <div className="brand-mark">
          <ShieldCheck size={34} aria-hidden="true" />
          <div>
            <h1>IT Guardian</h1>
            <p>Monitoramento integrado de infraestrutura</p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
