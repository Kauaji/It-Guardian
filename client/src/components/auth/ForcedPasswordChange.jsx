import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import AuthShell from "./AuthShell.jsx";
import ChangePasswordForm from "./ChangePasswordForm.jsx";

// Tela BLOQUEANTE: enquanto a conta tiver `mustChangePassword`, nada do app
// e montado (nao ha navegacao nem chamadas de dados). So da para trocar a
// senha ou sair.
export default function ForcedPasswordChange({ token, user, onChanged, onSignOut }) {
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <AuthShell labelledBy="forced-password-title">
      <div className="auth-step">
        <h2 id="forced-password-title" className="auth-step-title" tabIndex={-1} ref={titleRef}>
          Troque a senha para continuar
        </h2>
        <p className="auth-step-text">
          Sua senha é temporária ou foi redefinida por um administrador. Escolha uma senha nova que só você conheça.
        </p>
        <ChangePasswordForm token={token} user={user} onChanged={onChanged} submitLabel="Trocar senha e continuar" />
        <div className="auth-step-links">
          <button type="button" className="auth-link-button" onClick={onSignOut}>
            <LogOut size={14} aria-hidden="true" /> Sair
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
