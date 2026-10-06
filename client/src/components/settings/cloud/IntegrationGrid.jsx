import { CloudCog, PlugZap, RefreshCw } from "lucide-react";
import {
  formatDateTime,
  integrationBadgeClass,
  integrationNames,
  integrationStateLabel
} from "./cloudAdminModel.js";

function IntegrationCard({ source, name, integration, busyAction, onRun }) {
  return (
    <article>
      <div className="cloud-integration-heading">
        <CloudCog size={20} />
        <div>
          <strong>{name}</strong>
          <span className={`cloud-integration-badge ${integrationBadgeClass(integration)}`}>
            {integrationStateLabel(integration)}
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Modo</dt>
          <dd>{integration.configuration?.mode || "indisponivel"}</dd>
        </div>
        <div>
          <dt>Último sucesso</dt>
          <dd>{formatDateTime(integration.state?.lastSyncAt)}</dd>
        </div>
        <div>
          <dt>Conflitos</dt>
          <dd>{integration.conflicts?.length || 0}</dd>
        </div>
      </dl>
      {integration.error && (
        <small className="cloud-integration-error">{integration.error}</small>
      )}
      <div className="cloud-integration-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={busyAction === `test:${source}`}
          onClick={() => onRun(source, "test")}
        >
          <PlugZap size={15} />
          Testar
        </button>
        <button
          type="button"
          className="primary-action compact-action"
          disabled={busyAction === `sync:${source}`}
          onClick={() => onRun(source, "sync")}
        >
          <RefreshCw size={15} />
          Sincronizar
        </button>
      </div>
    </article>
  );
}

export default function IntegrationGrid({ integrations, busyAction, onRun }) {
  return (
    <section className="cloud-admin-section">
      <div className="cloud-admin-section-title">
        <div>
          <PlugZap size={18} />
          <strong>Integrações opcionais</strong>
        </div>
        <span>Somente leitura</span>
      </div>
      <div className="cloud-integration-grid">
        {Object.entries(integrationNames).map(([source, name]) => (
          <IntegrationCard
            key={source}
            source={source}
            name={name}
            integration={integrations[source] || {}}
            busyAction={busyAction}
            onRun={onRun}
          />
        ))}
      </div>
    </section>
  );
}
