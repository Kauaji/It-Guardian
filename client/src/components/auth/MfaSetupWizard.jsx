import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { enableMfa, startMfaSetup } from "../../api/identityApi.js";
import { copyText } from "../../auth/clipboard.js";
import { describeIdentityError } from "../../auth/errorMessages.js";
import { generateQrDataUrl } from "../../auth/qrCode.js";
import FormMessage from "./FormMessage.jsx";
import OneTimeCodeField from "./OneTimeCodeField.jsx";
import RecoveryCodesPanel from "./RecoveryCodesPanel.jsx";

function groupSecret(secret) {
  return String(secret || "").replace(/(.{4})/g, "$1 ").trim();
}

function useSetupFocus(step) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  return headingRef;
}

function IntroStep({ loading, error, onStart, onCancel }) {
  return (
    <>
      <p className="auth-step-text">
        Além da senha, você vai digitar um código de 6 dígitos gerado por um aplicativo autenticador (Google
        Authenticator, Microsoft Authenticator, 1Password, Aegis...). Você precisará do celular em mãos.
      </p>
      <FormMessage>{error}</FormMessage>
      <div className="auth-actions-row">
        <button type="button" className="primary-action compact-action" onClick={onStart} disabled={loading}>
          {loading ? "Gerando..." : "Começar"}
        </button>
        {onCancel && (
          <button type="button" className="ghost-action compact-action" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </>
  );
}

function ScanStep({ setup, qr, qrFailed, code, onCodeChange, error, loading, onConfirm, onCancel }) {
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    setCopied(await copyText(setup.secret));
  }

  return (
    <form onSubmit={onConfirm} className="auth-form" noValidate>
      <ol className="auth-steps-list">
        <li>Abra o aplicativo autenticador e adicione uma conta lendo o QR code abaixo.</li>
        <li>Digite o código de 6 dígitos que o aplicativo mostrar e confirme.</li>
      </ol>
      <div className="auth-qr-block">
        {qr ? (
          <img className="auth-qr" src={qr} alt="QR code para configurar o aplicativo autenticador" width={208} height={208} />
        ) : (
          <p className="auth-step-text">
            {qrFailed ? "Não foi possível gerar o QR code. Use a chave abaixo." : "Gerando QR code..."}
          </p>
        )}
        <div>
          <p className="auth-step-text">Não consegue ler o QR code? Digite esta chave no aplicativo:</p>
          <div className="auth-secret">
            <code aria-label="Chave de configuração">{groupSecret(setup.secret)}</code>
            <button type="button" className="secondary-action compact-action" onClick={copySecret}>
              <Copy size={14} aria-hidden="true" /> {copied ? "Copiada" : "Copiar chave"}
            </button>
          </div>
        </div>
      </div>
      <OneTimeCodeField label="Código do aplicativo" value={code} onChange={onCodeChange} />
      <FormMessage>{error}</FormMessage>
      <div className="auth-actions-row">
        <button className="primary-action compact-action" disabled={loading}>
          {loading ? "Confirmando..." : "Confirmar e ativar"}
        </button>
        {onCancel && (
          <button type="button" className="ghost-action compact-action" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

const stepTitles = {
  intro: "Ativar verificação em duas etapas",
  scan: "Escaneie o QR code",
  recovery: "Guarde seus códigos de recuperação"
};

// Assistente de MFA em 3 passos: (1) gerar segredo, (2) QR + confirmar com
// codigo, (3) codigos de recuperacao (mostrados UMA vez). `onComplete` so e
// chamado quando a pessoa confirma que guardou os codigos.
export default function MfaSetupWizard({ token, onComplete, onCancel, headingLevel = 2 }) {
  const [step, setStep] = useState("intro");
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const headingRef = useSetupFocus(step);
  const Heading = `h${headingLevel}`;

  async function start() {
    setError("");
    setLoading(true);
    try {
      const data = await startMfaSetup(token);
      setSetup(data);
      setCode("");
      setStep("scan");
      generateQrDataUrl(data.otpauthUri).then(setQr).catch(() => setQrFailed(true));
    } catch (failure) {
      setError(describeIdentityError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Digite os 6 dígitos do código.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await enableMfa(token, code);
      setSetup(null);
      setQr("");
      setRecoveryCodes(data.recoveryCodes || []);
      setStep("recovery");
    } catch (failure) {
      if (failure.code === "MFA_SETUP_NOT_STARTED") setStep("intro");
      setCode("");
      setError(describeIdentityError(failure));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-step">
      <Heading ref={headingRef} tabIndex={-1} className="auth-step-title" id="mfa-wizard-title">
        {stepTitles[step]}
      </Heading>
      {step === "intro" && <IntroStep loading={loading} error={error} onStart={start} onCancel={onCancel} />}
      {step === "scan" && (
        <ScanStep
          setup={setup}
          qr={qr}
          qrFailed={qrFailed}
          code={code}
          onCodeChange={setCode}
          error={error}
          loading={loading}
          onConfirm={confirm}
          onCancel={onCancel}
        />
      )}
      {step === "recovery" && (
        <>
          <p className="auth-step-text">A verificação em duas etapas está ativa.</p>
          <RecoveryCodesPanel codes={recoveryCodes} acknowledged={acknowledged} onAcknowledgedChange={setAcknowledged} />
          <button
            type="button"
            className="primary-action compact-action"
            disabled={!acknowledged}
            onClick={() => {
              setRecoveryCodes([]);
              onComplete();
            }}
          >
            Concluir
          </button>
        </>
      )}
    </div>
  );
}
