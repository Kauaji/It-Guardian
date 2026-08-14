import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboardSummary } from "../api.js";

const AUTO_REFRESH_MS = 60000;

export function useDashboardSummary({ token, canView, notify }) {
  const [period, setPeriod] = useState("30d");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(
    async (silent = false) => {
      if (!token || !canView) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const result = await fetchDashboardSummary(token, { period });
        setReport(result);
        setError("");
      } catch (fetchError) {
        setError(fetchError.message || "Nao foi possivel carregar o resumo do dashboard.");
        if (!silent) notifyRef.current?.(fetchError.message, "danger");
      } finally {
        setLoading(false);
      }
    },
    [token, canView, period]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !canView) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, token, canView]);

  return { report, loading, error, period, setPeriod, reload: () => load(false) };
}
