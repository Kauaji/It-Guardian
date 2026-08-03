import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Clipboard,
  CloudCog,
  Download,
  KeyRound,
  Laptop,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import {
  createProductKey,
  deactivateProductKeyActivation,
  fetchIntegrationStatus,
  fetchProductKeyActivations,
  fetchProductKeys,
  synchronizeIntegration,
  testIntegrationConnection,
  updateProductKeyStatus
} from "../../api.js";

const emptyForm = {
  displayName: "",
  organizationName: "",
  planName: "Beta",
  activationLimit: 1,
  expiresAt: ""
};

const integrationNames = {
  ocs: "OCS Inventory",
  zabbix: "Zabbix"
};

function formatDateTime(value) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nao informado";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function integrationStateLabel(integration) {
  if (integration.loading) return "Carregando";
  if (integration.error) return "Indisponivel";
  if (!integration.configuration?.enabled || integration.configuration?.mode === "disabled") {
    return "Desativada";
  }
  if (!integration.configuration?.configured) return "Incompleta";
  if (integration.state?.lastError) return "Com erro";
  return integration.state?.lastSyncAt ? "Sincronizada" : "Configurada";
}

function integrationBadgeClass(integration) {
  const label = integrationStateLabel(integration);
  if (label === "Sincronizada" || label === "Configurada") return "success";
  if (label === "Carregando" || label === "Desativada") return "muted";
  return "danger";
}

export default function CloudProductAdminPanel({ token, notify }) {
  const [productKeys, setProductKeys] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [createdKey, setCreatedKey] = useState(null);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [activations, setActivations] = useState([]);
  const [integrations, setIntegrations] = useState({
    ocs: { loading: true },
    zabbix: { loading: true }
  });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");

  const installerUrl = import.meta.env.VITE_COLLECTOR_INSTALLER_URL
    || "https://github.com/Kauaji/It-Guardian/releases/download/collector-v1.6.3/ITGuardian-Collector-Setup.exe";
  const selectedKey = useMemo(
    () => productKeys.find((item) => item.id === selectedKeyId) || null,
    [productKeys, selectedKeyId]
  );

  const showMessage = useCallback((message, type = "ok") => {
    notify?.(message, type);
  }, [notify]);

  const loadIntegrations = useCallback(async () => {
    const sources = ["ocs", "zabbix"];
    const results = await Promise.allSettled(
      sources.map((source) => fetchIntegrationStatus(token, source))
    );
    setIntegrations((current) => {
      const next = { ...current };
      sources.forEach((source, index) => {
        const result = results[index];
        next[source] = result.status === "fulfilled"
          ? { ...result.value, loading: false, error: "" }
          : { loading: false, error: result.reason?.message || "Falha ao consultar integracao." };
      });
      return next;
    });
  }, [token]);

  const loadProductKeys = useCallback(async () => {
    const response = await fetchProductKeys(token);
    const items = response.productKeys || [];
    setProductKeys(items);
    setSelectedKeyId((current) => (
      current && items.some((item) => item.id === current) ? current : ""
    ));
  }, [token]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([loadProductKeys(), loadIntegrations()])
      .then((results) => {
        if (!active) return;
        const keyResult = results[0];
        if (keyResult.status === "rejected") {
          showMessage(keyResult.reason?.message || "Falha ao carregar chaves.", "danger");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadIntegrations, loadProductKeys, showMessage]);

  useEffect(() => {
    if (!selectedKeyId) {
      setActivations([]);
      return;
    }
    let active = true;
    setBusyAction(`activations:${selectedKeyId}`);
    fetchProductKeyActivations(token, selectedKeyId)
      .then((response) => {
        if (active) setActivations(response.activations || []);
      })
      .catch((error) => {
        if (active) showMessage(error.message, "danger");
      })
      .finally(() => {
        if (active) {
          setBusyAction((current) => (
            current === `activations:${selectedKeyId}` ? "" : current
          ));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedKeyId, showMessage, token]);

  async function submitProductKey(event) {
    event.preventDefault();
    if (!form.displayName.trim() || !form.organizationName.trim()) {
      showMessage("Informe o nome da chave e a organizacao.", "danger");
      return;
    }

    setBusyAction("create-key");
    try {
      const response = await createProductKey(token, {
        ...form,
        activationLimit: Number(form.activationLimit),
        expiresAt: form.expiresAt || null
      });
      setCreatedKey({
        value: response.key,
        warning: response.warning,
        productKey: response.productKey
      });
      setForm(emptyForm);
      await loadProductKeys();
      showMessage("Chave de produto criada.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function copyCreatedKey() {
    if (!createdKey?.value) return;
    try {
      await navigator.clipboard.writeText(createdKey.value);
      showMessage("Chave copiada. Guarde-a em um local seguro.");
    } catch {
      showMessage("Nao foi possivel copiar automaticamente. Selecione a chave exibida.", "danger");
    }
  }

  async function changeProductKeyStatus(item) {
    if (
      item.active &&
      !window.confirm("Desativar esta chave e todos os coletores vinculados?")
    ) {
      return;
    }
    setBusyAction(`key:${item.id}`);
    try {
      await updateProductKeyStatus(token, item.id, !item.active);
      await loadProductKeys();
      if (selectedKeyId === item.id) {
        const response = await fetchProductKeyActivations(token, item.id);
        setActivations(response.activations || []);
      }
      showMessage(item.active ? "Chave desativada." : "Chave reativada.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function deactivateActivation(item) {
    if (!window.confirm(`Desativar o coletor de ${item.hostname}?`)) return;
    setBusyAction(`activation:${item.id}`);
    try {
      await deactivateProductKeyActivation(token, item.id);
      const response = await fetchProductKeyActivations(token, selectedKeyId);
      setActivations(response.activations || []);
      await loadProductKeys();
      showMessage("Coletor desativado.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function runIntegrationAction(source, action) {
    const actionKey = `${action}:${source}`;
    setBusyAction(actionKey);
    try {
      const response = action === "test"
        ? await testIntegrationConnection(token, source)
        : await synchronizeIntegration(token, source);
      showMessage(
        response.skipped
          ? `${integrationNames[source]} esta desativado.`
          : action === "test"
            ? `Conexao com ${integrationNames[source]} validada.`
            : `${integrationNames[source]} sincronizado.`
      );
      await loadIntegrations();
    } catch (error) {
      showMessage(error.message, "danger");
      await loadIntegrations();
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="cloud-admin-panel">
      <header className="cloud-admin-heading">
        <div>
          <strong>Cloud e coletores</strong>
          <span>Licenciamento, computadores ativados e fontes opcionais de inventario.</span>
        </div>
        {installerUrl ? (
          <a
            className="secondary-action compact-action cloud-installer-action"
            href={installerUrl}
            download
          >
            <Download size={16} />
            Baixar instalador
          </a>
        ) : (
          <button
            type="button"
            className="secondary-action compact-action cloud-installer-action"
            disabled
            title="Defina VITE_COLLECTOR_INSTALLER_URL no build do frontend."
          >
            <Download size={16} />
            Instalador indisponivel
          </button>
        )}
      </header>

      <div className="cloud-admin-create-layout">
        <form className="admin-form-card cloud-key-form" onSubmit={submitProductKey}>
          <div className="admin-form-header">
            <strong><KeyRound size={17} /> Nova chave</strong>
            <span className="cloud-security-note"><ShieldCheck size={15} /> SHA-256</span>
          </div>
          <div className="admin-form-grid">
            <label>
              Nome de exibicao
              <input
                value={form.displayName}
                maxLength={120}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  displayName: event.target.value
                }))}
                placeholder="Cliente principal"
              />
            </label>
            <label>
              Organizacao
              <input
                value={form.organizationName}
                maxLength={160}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  organizationName: event.target.value
                }))}
                placeholder="Empresa"
              />
            </label>
            <label>
              Plano
              <input
                value={form.planName}
                maxLength={80}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  planName: event.target.value
                }))}
              />
            </label>
            <label>
              Limite de computadores
              <input
                type="number"
                min="1"
                max="100000"
                value={form.activationLimit}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  activationLimit: event.target.value
                }))}
              />
            </label>
            <label>
              Expira em
              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  expiresAt: event.target.value
                }))}
              />
            </label>
          </div>
          <button
            type="submit"
            className="primary-action compact-action"
            disabled={busyAction === "create-key"}
          >
            {busyAction === "create-key" ? <LoaderCircle className="spin" size={16} /> : <KeyRound size={16} />}
            Gerar chave
          </button>
        </form>

        <section className={`cloud-key-reveal${createdKey ? " visible" : ""}`}>
          <ShieldCheck size={21} />
          <div>
            <strong>{createdKey ? "Chave criada" : "Exibicao unica"}</strong>
            <span>
              {createdKey
                ? createdKey.warning
                : "A chave completa aparece aqui uma unica vez e nunca e armazenada em texto puro."}
            </span>
          </div>
          {createdKey && (
            <>
              <code>{createdKey.value}</code>
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={copyCreatedKey}
              >
                <Clipboard size={16} />
                Copiar
              </button>
            </>
          )}
        </section>
      </div>

      <section className="cloud-admin-section">
        <div className="cloud-admin-section-title">
          <div>
            <KeyRound size={18} />
            <strong>Chaves de produto</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={loadProductKeys}
            disabled={loading}
            title="Atualizar chaves"
            aria-label="Atualizar chaves"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {loading && <p className="empty">Carregando chaves...</p>}
        {!loading && productKeys.length === 0 && (
          <p className="empty">Nenhuma chave de produto cadastrada.</p>
        )}
        <div className="cloud-key-list">
          {productKeys.map((item) => (
            <article key={item.id} className={item.active ? "" : "inactive"}>
              <button
                type="button"
                className="cloud-key-summary"
                onClick={() => setSelectedKeyId((current) => current === item.id ? "" : item.id)}
                aria-expanded={selectedKeyId === item.id}
              >
                <span className={`cloud-key-state${item.active ? " active" : ""}`}>
                  {item.active ? <Check size={15} /> : <Ban size={15} />}
                </span>
                <span>
                  <strong>{item.displayName}</strong>
                  <small>{item.organizationName} - {item.planName}</small>
                </span>
                <code>{item.keyHint}</code>
                <span className="cloud-key-usage">
                  {item.activationCount} / {item.activationLimit}
                  <small>ativacoes</small>
                </span>
                <span className="cloud-key-expiry">
                  {item.expiresAt ? `Expira ${formatDateTime(item.expiresAt)}` : "Sem expiracao"}
                </span>
              </button>
              <div className="cloud-key-actions">
                <button
                  type="button"
                  className={item.active ? "danger-action compact-action" : "secondary-action compact-action"}
                  onClick={() => changeProductKeyStatus(item)}
                  disabled={busyAction === `key:${item.id}`}
                >
                  {item.active ? <Ban size={15} /> : <Check size={15} />}
                  {item.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selectedKey && (
        <section className="cloud-admin-section">
          <div className="cloud-admin-section-title">
            <div>
              <Laptop size={18} />
              <strong>Computadores de {selectedKey.displayName}</strong>
            </div>
            <span>{activations.length} registro(s)</span>
          </div>
          {busyAction === `activations:${selectedKeyId}` && (
            <p className="empty">Carregando computadores...</p>
          )}
          {busyAction !== `activations:${selectedKeyId}` && activations.length === 0 && (
            <p className="empty">Nenhum computador ativou esta chave.</p>
          )}
          <div className="cloud-activation-list">
            {activations.map((item) => (
              <article key={item.id}>
                <span className={`cloud-activation-status ${item.status}`}>
                  <span />
                  {item.status === "active" ? "Ativo" : "Desativado"}
                </span>
                <div>
                  <strong>{item.alias || item.hostname}</strong>
                  <small>
                    {item.alias ? `${item.hostname} - ` : ""}
                    coletor {item.collectorVersion || "sem versao"}
                  </small>
                </div>
                <small>Primeira ativacao: {formatDateTime(item.firstSeenAt)}</small>
                <small>Ultimo contato: {formatDateTime(item.lastSeenAt)}</small>
                <button
                  type="button"
                  className="danger-action compact-action"
                  disabled={
                    item.status !== "active" ||
                    busyAction === `activation:${item.id}`
                  }
                  onClick={() => deactivateActivation(item)}
                >
                  <Ban size={15} />
                  Desativar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="cloud-admin-section">
        <div className="cloud-admin-section-title">
          <div>
            <PlugZap size={18} />
            <strong>Integracoes opcionais</strong>
          </div>
          <span>Somente leitura</span>
        </div>
        <div className="cloud-integration-grid">
          {Object.entries(integrationNames).map(([source, name]) => {
            const integration = integrations[source] || {};
            const stateLabel = integrationStateLabel(integration);
            return (
              <article key={source}>
                <div className="cloud-integration-heading">
                  <CloudCog size={20} />
                  <div>
                    <strong>{name}</strong>
                    <span className={`cloud-integration-badge ${integrationBadgeClass(integration)}`}>
                      {stateLabel}
                    </span>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Modo</dt>
                    <dd>{integration.configuration?.mode || "indisponivel"}</dd>
                  </div>
                  <div>
                    <dt>Ultimo sucesso</dt>
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
                    onClick={() => runIntegrationAction(source, "test")}
                  >
                    <PlugZap size={15} />
                    Testar
                  </button>
                  <button
                    type="button"
                    className="primary-action compact-action"
                    disabled={busyAction === `sync:${source}`}
                    onClick={() => runIntegrationAction(source, "sync")}
                  >
                    <RefreshCw size={15} />
                    Sincronizar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
