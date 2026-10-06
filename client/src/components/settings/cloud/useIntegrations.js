import { useCallback, useState } from "react";
import { fetchIntegrationStatus, synchronizeIntegration, testIntegrationConnection } from "../../../api.js";
import { integrationActionMessage, mergeIntegrationResults } from "./cloudAdminModel.js";

const sources = ["ocs", "zabbix"];

/** Estado de OCS/Zabbix e as ações de testar conexão e sincronizar. */
export function useIntegrations({ token, showMessage, setBusyAction }) {
  const [integrations, setIntegrations] = useState({
    ocs: { loading: true },
    zabbix: { loading: true }
  });

  const loadIntegrations = useCallback(async () => {
    const results = await Promise.allSettled(
      sources.map((source) => fetchIntegrationStatus(token, source))
    );
    setIntegrations((current) => mergeIntegrationResults(current, sources, results));
  }, [token]);

  async function runIntegrationAction(source, action) {
    setBusyAction(`${action}:${source}`);
    try {
      const response = action === "test"
        ? await testIntegrationConnection(token, source)
        : await synchronizeIntegration(token, source);
      showMessage(integrationActionMessage(source, action, response));
      await loadIntegrations();
    } catch (error) {
      showMessage(error.message, "danger");
      await loadIntegrations();
    } finally {
      setBusyAction("");
    }
  }

  return { integrations, loadIntegrations, runIntegrationAction };
}
