import { useState } from "react";
import { createPortal } from "react-dom";
import { Copy, KeyRound, ShieldOff, TriangleAlert } from "lucide-react";
import { adminResetMfa, adminResetPassword } from "../../api/identityApi.js";
import { copyText } from "../../auth/clipboard.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import FormMessage from "../auth/FormMessage.jsx";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import "../auth/auth.css";

function Dialog({ title, labelId, onClose, children }) {
  const dialogRef = useModalLifecycle(true, onClose);
  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <div ref={dialogRef} className="modal-panel auth-dialog" role="alertdialog" aria-modal="true" aria-labelledby={labelId}>
        <header>
          <h2 id={labelId}>{title}</h2>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ConfirmDialog({ kind, target, busy, error, onConfirm, onClose }) {
  const isPassword = kind === "password";
  return (
    <Dialog title={isPassword ? "Redefinir senha" : "Redefinir MFA"} labelId="admin-reset-title" onClose={onClose}>
      <p>
        {isPassword
          ? `Gerar uma senha temporária para ${target.name} (${target.email})? Todas as sessões da pessoa serão encerradas e ela precisará trocar a senha no próximo acesso.`
          : `Remover a verificação em duas etapas de ${target.name} (${target.email})? Use apenas para quem perdeu o aparelho e os códigos de recuperação. As sessões da pessoa serão encerradas e ela poderá cadastrar o MFA de novo.`}
      </p>
      <FormMessage>{error}</FormMessage>
      <div className="auth-actions-row">
        <button type="button" className="danger-action compact-action" onClick={onConfirm} disabled={busy}>
          {busy ? "Aguarde..." : isPassword ? "Gerar senha temporária" : "Remover MFA"}
        </button>
        <button type="button" className="ghost-action compact-action" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
      </div>
    </Dialog>
  );
}

function TemporaryPasswordDialog({ target, temporaryPassword, onClose }) {
  const [copied, setCopied] = useState(null);

  return (
    <Dialog title="Senha temporária gerada" labelId="admin-temp-password-title" onClose={onClose}>
      <p>Senha temporária de {target.name}. Repasse por um canal seguro; a pessoa precisará trocá-la ao entrar.</p>
      <div className="auth-secret">
        <code aria-label="Senha temporária">{temporaryPassword}</code>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={async () => setCopied(await copyText(temporaryPassword))}
        >
          <Copy size={14} aria-hidden="true" /> {copied ? "Copiada" : "Copiar"}
        </button>
      </div>
      {copied === false && <FormMessage>Não foi possível copiar. Selecione a senha e copie manualmente.</FormMessage>}
      <div className="auth-callout" role="note">
        <TriangleAlert size={18} aria-hidden="true" />
        <p>
          <strong>Esta senha aparece só agora</strong> e não pode ser consultada depois. Se perdê-la, gere outra.
        </p>
      </div>
      <div className="auth-actions-row">
        <button type="button" className="primary-action compact-action" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Dialog>
  );
}

// Acoes de administrador sobre a conta de OUTRA pessoa: redefinir senha
// (devolve senha temporaria, mostrada uma vez) e redefinir MFA. A propria
// conta nao aparece aqui: use "Seguranca da conta".
export default function UserSecurityActions({ token, target, currentUserId, disabled = false, notify }) {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!target || target.id === currentUserId) return null;

  function close() {
    setDialog(null);
    setError("");
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      if (dialog.kind === "password") {
        const result = await adminResetPassword(token, target.id);
        setDialog({ kind: "result", temporaryPassword: result.temporaryPassword });
      } else {
        await adminResetMfa(token, target.id);
        notify(`MFA de ${target.name} removido. A pessoa pode cadastrar de novo no próximo acesso.`, "ok");
        close();
      }
    } catch (failure) {
      setError(describeIdentityError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="secondary-action compact-action"
        disabled={disabled}
        onClick={() => setDialog({ kind: "password" })}
        aria-label={`Redefinir senha de ${target.name}`}
      >
        <KeyRound size={14} aria-hidden="true" /> Redefinir senha
      </button>
      {target.mfaEnabled && (
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={disabled}
          onClick={() => setDialog({ kind: "mfa" })}
          aria-label={`Redefinir MFA de ${target.name}`}
        >
          <ShieldOff size={14} aria-hidden="true" /> Redefinir MFA
        </button>
      )}
      {(dialog?.kind === "password" || dialog?.kind === "mfa") && (
        <ConfirmDialog kind={dialog.kind} target={target} busy={busy} error={error} onConfirm={confirm} onClose={close} />
      )}
      {dialog?.kind === "result" && (
        <TemporaryPasswordDialog target={target} temporaryPassword={dialog.temporaryPassword} onClose={close} />
      )}
    </>
  );
}
