import { useEffect, useState } from "react";
import { previewDashboardWidget } from "../api.js";

const MIN_REFRESH_MS = 30000;

/**
 * Um hook por widget renderizado (nao um por dashboard inteiro) -- cada
 * widget tem seu proprio refreshIntervalSeconds configurado, entao cada um
 * agenda seu proprio poll. O controller "atual" e sempre abortado na
 * limpeza (desmonte ou troca de type/config/enabled), mesmo se estiver no
 * meio de uma requisicao -- evita que uma resposta lenta de uma config
 * antiga (widget reconfigurado) sobrescreva o estado da config nova.
 */
export function useWidgetData({ token, type, config, refreshIntervalSeconds, enabled = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configKey = JSON.stringify(config || {});

  useEffect(() => {
    if (!enabled || !token || !type) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let currentController = null;
    const intervalMs = Math.max(MIN_REFRESH_MS, (refreshIntervalSeconds || 60) * 1000);

    async function poll() {
      currentController = new AbortController();
      setLoading(true);
      try {
        const result = await previewDashboardWidget(token, { type, config }, { signal: currentController.signal });
        if (cancelled) return;
        setData(result.data);
        setError("");
      } catch (fetchError) {
        if (fetchError.name === "AbortError" || cancelled) return;
        setError(fetchError.message || "Nao foi possivel carregar este widget.");
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) timer = window.setTimeout(poll, intervalMs);
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      currentController?.abort();
    };
  }, [enabled, token, type, configKey, refreshIntervalSeconds]);

  return { data, loading, error };
}
