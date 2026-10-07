import { LogOut } from "lucide-react";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";
import AuthShell from "./AuthShell.jsx";
import MfaSetupWizard from "./MfaSetupWizard.jsx";

// Tela BLOQUEANTE do cadastro obrigatorio de MFA (administradores, quando o
// servidor exige). O app so abre depois que a pessoa conclui o assistente.
export default function MfaEnrollmentGate({ token, onComplete, onSignOut }) {
  useDocumentTitle("Verificação em duas etapas");
  return (
    <AuthShell wide labelledBy="mfa-wizard-title">
      <p className="auth-step-text auth-enrollment-note">
        Administradores precisam proteger a conta com verificação em duas etapas antes de usar o sistema.
      </p>
      <MfaSetupWizard token={token} onComplete={onComplete} />
      <div className="auth-step-links">
        <button type="button" className="auth-link-button" onClick={onSignOut}>
          <LogOut size={14} aria-hidden="true" /> Sair
        </button>
      </div>
    </AuthShell>
  );
}
