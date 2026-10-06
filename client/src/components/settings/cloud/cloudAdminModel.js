// Modelo puro do painel de chaves de produto e integrações (rótulos e formatação).

export const emptyForm = {
  displayName: "",
  organizationName: "",
  planName: "Beta",
  activationLimit: 1,
  expiresAt: ""
};

export const integrationNames = {
  ocs: "OCS Inventory",
  zabbix: "Zabbix"
};

export const defaultInstallerUrl =
  "https://github.com/Kauaji/It-Guardian/releases/download/collector-v1.6.3/ITGuardian-Collector-Setup.exe";

export function formatDateTime(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function integrationStateLabel(integration) {
  if (integration.loading) return "Carregando";
  if (integration.error) return "Indisponível";
  if (!integration.configuration?.enabled || integration.configuration?.mode === "disabled") {
    return "Desativada";
  }
  if (!integration.configuration?.configured) return "Incompleta";
  if (integration.state?.lastError) return "Com erro";
  return integration.state?.lastSyncAt ? "Sincronizada" : "Configurada";
}

export function integrationBadgeClass(integration) {
  const label = integrationStateLabel(integration);
  if (label === "Sincronizada" || label === "Configurada") return "success";
  if (label === "Carregando" || label === "Desativada") return "muted";
  return "danger";
}

/** Mensagem de sucesso de testar/sincronizar uma integração. */
export function integrationActionMessage(source, action, response) {
  if (response.skipped) return `${integrationNames[source]} esta desativado.`;
  return action === "test"
    ? `Conexão com ${integrationNames[source]} validada.`
    : `${integrationNames[source]} sincronizado.`;
}

/** Converte os resultados de Promise.allSettled das fontes no estado das integrações. */
export function mergeIntegrationResults(current, sources, results) {
  const next = { ...current };
  sources.forEach((source, index) => {
    const result = results[index];
    next[source] = result.status === "fulfilled"
      ? { ...result.value, loading: false, error: "" }
      : { loading: false, error: result.reason?.message || "Falha ao consultar integração." };
  });
  return next;
}
