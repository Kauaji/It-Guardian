import { Eye, KeyRound, MonitorUp, MousePointer2, RefreshCw, ShieldCheck } from "lucide-react";
import { getRemoteAssetLastSeenAt } from "../remoteAssistanceModel.js";
import { formatDateTime } from "../utils/format.js";

function MachineSummary({ asset }) {
  return (
    <section className="remote-assistance-machine-summary" aria-label="Dados da maquina">
      <div><span>Sistema</span><strong>{asset.os || asset.operatingSystem || "Nao informado"}</strong></div>
      <div><span>Ultimo contato</span><strong>{formatDateTime(getRemoteAssetLastSeenAt(asset))}</strong></div>
      <div><span>Agente</span><strong>{asset.agentVersion || asset.agent?.version || "Ativo"}</strong></div>
      <div><span>Usuario local</span><strong>{asset.localUser || asset.agent?.localUser || "Nao coletado"}</strong></div>
    </section>
  );
}

function ModeFieldset({ requestedMode, onModeChange, controlOptionVisible }) {
  return (
    <fieldset className="remote-assistance-mode">
      <legend>Permissao solicitada</legend>
      <label>
        <input type="radio" name="remote-mode" value="view" checked={requestedMode === "view"} onChange={() => onModeChange("view")} />
        <Eye size={16} /> Somente visualizar
      </label>
      {controlOptionVisible && (
        <label>
          <input type="radio" name="remote-mode" value="control" checked={requestedMode === "control"} onChange={() => onModeChange("control")} />
          <MousePointer2 size={16} /> Solicitar mouse e teclado
        </label>
      )}
    </fieldset>
  );
}

// Formulario inicial: motivo, modo e reautenticacao (senha) do tecnico.
export default function RemoteReauthPanel({
  asset,
  serviceOrder,
  form,
  controlOptionVisible,
  error,
  submitting,
  onSubmit
}) {
  return (
    <form className="remote-assistance-request" onSubmit={onSubmit}>
      <MachineSummary asset={asset} />

      {serviceOrder && (
        <p className="remote-assistance-os-link">Vinculado a OS {serviceOrder.number || serviceOrder.id}</p>
      )}

      <label>
        Motivo do atendimento
        <textarea
          value={form.reason}
          onChange={(event) => form.setReason(event.target.value)}
          minLength={5}
          maxLength={500}
          required
          placeholder="Descreva o objetivo deste acesso"
        />
      </label>

      <ModeFieldset
        requestedMode={form.requestedMode}
        onModeChange={form.setRequestedMode}
        controlOptionVisible={controlOptionVisible}
      />

      <label>
        Confirme sua senha
        <span className="remote-assistance-password">
          <KeyRound size={17} />
          <input
            type="password"
            value={form.password}
            onChange={(event) => form.setPassword(event.target.value)}
            autoComplete="current-password"
            required
            placeholder="Senha do seu login"
          />
        </span>
      </label>

      <div className="remote-assistance-security-note">
        <ShieldCheck size={18} />
        <p>O usuario precisa autorizar localmente. A solicitacao, o consentimento e o encerramento ficam registrados.</p>
      </div>
      <p className="remote-assistance-disabled-feature">Modo privacidade e acoes administrativas permanecem indisponiveis nesta fase.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-action remote-assistance-submit" disabled={submitting}>
        {submitting ? <RefreshCw size={17} className="spin" /> : <MonitorUp size={17} />}
        Solicitar atendimento
      </button>
    </form>
  );
}
