import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { disableMfa, fetchMfaStatus, regenerateRecoveryCodes } from "../../api/identityApi.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import FormMessage from "./FormMessage.jsx";
import MfaSetupWizard from "./MfaSetupWizard.jsx";
import RecoveryCodesPanel from "./RecoveryCodesPanel.jsx";
import SecondFactorForm from "./SecondFactorForm.jsx";

function StatusLine({ status }) {
  if (!status.enabled) {
    return (
      <p className="auth-status off">
        <ShieldOff size={18} aria-hidden="true" /> <strong>Desativada.</strong> Sua conta usa apenas senha.
      </p>
    );
  }
  return (
    <p className="auth-status on">
      <ShieldCheck size={18} aria-hidden="true" /> <strong>Ativada.</strong> Códigos de recuperação restantes: {status.recoveryCodesLeft}.
    </p>
  );
}

// Secao "Verificacao em duas etapas" da pagina de seguranca. `mode` controla
// qual fluxo esta aberto: null | "enable" | "disable" | "regenerate" | "codes".
export default function MfaSection({ token, user, notify, onUserChanged }) {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState(null);
  const [newCodes, setNewCodes] = useState([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchMfaStatus(token));
      setLoadError("");
    } catch (error) {
      setLoadError(describeIdentityError(error, "Não foi possível carregar o estado da verificação em duas etapas."));
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function finishEnable() {
    setMode(null);
    notify("Verificação em duas etapas ativada.", "ok");
    await Promise.all([load(), onUserChanged()]);
  }

  async function submitDisable(credentials) {
    await disableMfa(token, credentials);
    setMode(null);
    notify("Verificação em duas etapas desativada.", "ok");
    await Promise.all([load(), onUserChanged()]);
  }

  async function submitRegenerate(credentials) {
    const data = await regenerateRecoveryCodes(token, credentials);
    setNewCodes(data.recoveryCodes || []);
    setAcknowledged(false);
    setMode("codes");
    load();
  }

  function closeCodes() {
    setNewCodes([]);
    setMode(null);
  }

  const lockedByPolicy = Boolean(status?.requiredForAdmins && (user?.isAdmin || user?.role === "admin"));

  return (
    <section className="account-section" aria-labelledby="mfa-section-title">
      <h3 id="mfa-section-title">Verificação em duas etapas (MFA)</h3>
      <p className="auth-step-text">Pede um código do seu aplicativo autenticador além da senha. Protege a conta mesmo se a senha vazar.</p>
      <FormMessage>{loadError}</FormMessage>
      {status && <StatusLine status={status} />}

      {status && mode === null && (
        <div className="auth-actions-row">
          {!status.enabled && (
            <button type="button" className="primary-action compact-action" onClick={() => setMode("enable")}>
              Ativar verificação em duas etapas
            </button>
          )}
          {status.enabled && (
            <>
              <button type="button" className="secondary-action compact-action" onClick={() => setMode("regenerate")}>
                <KeyRound size={16} aria-hidden="true" /> Gerar novos códigos de recuperação
              </button>
              {!lockedByPolicy && (
                <button type="button" className="danger-action compact-action" onClick={() => setMode("disable")}>
                  Desativar
                </button>
              )}
            </>
          )}
        </div>
      )}
      {status?.enabled && lockedByPolicy && mode === null && (
        <p className="auth-step-text">A verificação em duas etapas é obrigatória para administradores e não pode ser desativada.</p>
      )}

      {mode === "enable" && <MfaSetupWizard token={token} headingLevel={4} onComplete={finishEnable} onCancel={() => setMode(null)} />}
      {mode === "disable" && (
        <SecondFactorForm
          title="Desativar verificação em duas etapas"
          description="Confirme com sua senha e um código para desativar. Seus códigos de recuperação atuais deixam de valer."
          submitLabel="Desativar"
          danger
          onSubmit={submitDisable}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === "regenerate" && (
        <SecondFactorForm
          title="Gerar novos códigos de recuperação"
          description="Os códigos antigos deixam de funcionar assim que os novos forem gerados."
          submitLabel="Gerar novos códigos"
          onSubmit={submitRegenerate}
          onCancel={() => setMode(null)}
        />
      )}
      {mode === "codes" && (
        <div className="auth-inline-form">
          <h4 className="auth-subtitle">Novos códigos de recuperação</h4>
          <RecoveryCodesPanel codes={newCodes} acknowledged={acknowledged} onAcknowledgedChange={setAcknowledged} />
          <button type="button" className="primary-action compact-action" disabled={!acknowledged} onClick={closeCodes}>
            Concluir
          </button>
        </div>
      )}
    </section>
  );
}
