import { useEffect, useState } from "react";
import { previewDashboardWidget } from "../api.js";

const MIN_REFRESH_MS = 30000;

/** Polling is scoped to the exact query. A previous scope is never shown as
 * the result of a new selection, even while that selection is loading. */
export function useWidgetData({ token, type, config, filters, refreshIntervalSeconds, enabled = true }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const configKey = JSON.stringify(config || {});
  const filtersKey = JSON.stringify(filters || {});
  const requestKey = JSON.stringify([token, type, configKey, filtersKey]);

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
        const params = { type, config };
        if (Object.keys(filters || {}).length) params.filters = filters;
        const result = await previewDashboardWidget(token, params, { signal: currentController.signal });
        if (cancelled) return;
        setSnapshot({ requestKey, data: result.data, error: "" });
      } catch (fetchError) {
        if (fetchError.name === "AbortError" || cancelled) return;
        setSnapshot((current) => ({
          requestKey,
          data: current?.requestKey === requestKey ? current.data : null,
          error: fetchError.message || "Não foi possível carregar este widget."
        }));
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
  }, [enabled, requestKey, refreshIntervalSeconds]);

  const current = snapshot?.requestKey === requestKey ? snapshot : null;
  return {
    data: current?.data ?? null,
    loading: Boolean(enabled && token && type && (loading || !current)),
    error: current?.error || ""
  };
}
