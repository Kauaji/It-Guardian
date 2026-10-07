import { useCallback, useEffect, useState } from "react";
import { useIntegrations } from "./useIntegrations.js";
import { useKeyActivations, useProductKeys } from "./useProductKeys.js";
import { useKeyMutations } from "./useKeyMutations.js";

/** Compõe o estado do painel Cloud e coletores (chaves, computadores e integrações). */
export function useCloudAdmin(token, notify) {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");

  const showMessage = useCallback(
    (message, type = "ok") => {
      notify?.(message, type);
    },
    [notify]
  );

  const integrationState = useIntegrations({ token, showMessage, setBusyAction });
  const keys = useProductKeys(token);
  const { loadIntegrations } = integrationState;
  const { loadProductKeys } = keys;

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

  const { activations, setActivations } = useKeyActivations({
    token,
    selectedKeyId: keys.selectedKeyId,
    showMessage,
    setBusyAction
  });

  const mutations = useKeyMutations({
    token,
    showMessage,
    setBusyAction,
    loadProductKeys,
    selectedKeyId: keys.selectedKeyId,
    setActivations
  });

  return { loading, busyAction, activations, ...integrationState, ...keys, ...mutations };
}
