import { formatHardwareValue } from "../hardwarePresentation.js";
import { formatDate } from "./machineDetailsModel.js";

export default function ErrorAlertList({ alerts, resolvedAlerts }) {
  return (
    <section className="asset-tab-content">
      <div className="error-alert-section">
        <div>
          <h3>Alertas ativos</h3>
          <span>{alerts.length} em andamento</span>
        </div>
        <div className="error-alert-list">
          {alerts.map((alert) => (
            <article key={alert.id} className={`error-alert-card ${alert.severity === "Crítico" ? "critical" : "warning"}`}>
              <header>
                <strong>{formatHardwareValue(alert.description, "Alerta ativo")}</strong>
                <span>{formatHardwareValue(alert.status, "Ativo")}</span>
              </header>
              <dl>
                <div><dt>Detectado</dt><dd>{formatDate(alert.detectedAt)}</dd></div>
                <div><dt>Tipo</dt><dd>{formatHardwareValue(alert.type)}</dd></div>
                <div><dt>Severidade</dt><dd>{formatHardwareValue(alert.severity)}</dd></div>
                <div><dt>Métrica</dt><dd>{formatHardwareValue(alert.metric)}</dd></div>
                <div><dt>Valor atual</dt><dd>{formatHardwareValue(alert.value)}</dd></div>
                <div><dt>Limite</dt><dd>{formatHardwareValue(alert.limit)}</dd></div>
              </dl>
            </article>
          ))}
          {!alerts.length && <p className="empty">Nenhum alerta ativo neste momento.</p>}
        </div>
      </div>

      <div className="error-alert-section resolved">
        <div>
          <h3>Resolvidos no histórico</h3>
          <span>{resolvedAlerts.length} registros</span>
        </div>
        <div className="error-alert-list compact">
          {resolvedAlerts.map((alert) => (
            <article key={alert.id} className="error-alert-card resolved">
              <header>
                <strong>{formatHardwareValue(alert.description, "Alerta resolvido")}</strong>
                <span>{formatHardwareValue(alert.status, "Resolvido")}</span>
              </header>
              <p>{formatHardwareValue(alert.metric)}: {formatHardwareValue(alert.limit)} para {formatHardwareValue(alert.value)} em {formatDate(alert.detectedAt)}</p>
            </article>
          ))}
          {!resolvedAlerts.length && <p className="empty">Nenhum erro resolvido registrado ainda.</p>}
        </div>
      </div>
    </section>
  );
}
