import { XCircle } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import { formatDisplayText, getDeviceDisplayName } from "../alertUtils.js";
import { getSafeScriptLabel } from "../alertDisplayUtils.js";

function DevicesSummary({ devices }) {
  return (
    <section>
      <h3>Máquinas selecionadas</h3>
      <strong>{devices.length} máquina(s)</strong>
      <ul>
        {devices.slice(0, 6).map((device) => (
          <li key={device.id}>{getDeviceDisplayName(device)}</li>
        ))}
        {devices.length > 6 && <li>+ {devices.length - 6} máquina(s)</li>}
      </ul>
    </section>
  );
}

function ScriptsSummary({ scripts, riskScripts }) {
  return (
    <>
      <section>
        <h3>Verificações selecionadas</h3>
        <strong>{scripts.length} verificação(ões)</strong>
        <ul>
          {scripts.map((script) => (
            <li key={script.id}>
              {getSafeScriptLabel(script)}
              <span>{formatDisplayText(script.riskLevel, "medio")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Riscos</h3>
        {riskScripts.length ? (
          <ul>
            {riskScripts.map((script) => (
              <li key={script.id}>
                {getSafeScriptLabel(script)} — {formatDisplayText(script.riskLevel, "medio")}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma verificação de alto risco selecionada.</p>
        )}
      </section>
    </>
  );
}

// Revisao final do plano manual antes de registrar (nao executa scripts).
export default function PreventiveReviewModal({ preventive }) {
  const { planName, saving, selectedDevices, selectedScripts, riskScripts, closeReview } = preventive;
  const dialogRef = useModalLifecycle(true, closeReview);

  return (
    <div className="modal-backdrop preventive-review-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="modal-panel preventive-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preventive-review-title"
      >
        <header>
          <div>
            <span>Revisão da preventiva</span>
            <h2 id="preventive-review-title">Registrar plano preventivo</h2>
            <p>Confira o escopo antes de registrar. Esta tela não executa scripts nem envia comandos para máquinas.</p>
          </div>
          <button type="button" className="icon-button" onClick={closeReview} aria-label="Fechar revisão">
            <XCircle size={18} />
          </button>
        </header>

        <div className="preventive-review-grid">
          <section>
            <h3>Plano</h3>
            <dl>
              <div>
                <dt>Nome</dt>
                <dd>{planName || "Plano preventivo"}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>Manual, pelo módulo de Avisos</dd>
              </div>
            </dl>
          </section>
          <DevicesSummary devices={selectedDevices} />
          <ScriptsSummary scripts={selectedScripts} riskScripts={riskScripts} />
        </div>

        <footer>
          <button type="button" className="secondary-action" onClick={closeReview} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="primary-action" onClick={preventive.confirmRegistration} disabled={saving}>
            {saving ? "Registrando..." : "Registrar preventiva"}
          </button>
        </footer>
      </section>
    </div>
  );
}
