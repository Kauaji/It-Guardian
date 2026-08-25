import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboardLayout, resetDashboardLayout, saveDashboardLayout } from "../api.js";

export function useDashboardLayout({ token, canView, notify }) {
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchDashboardLayout(token);
      setLayout(result);
      setError("");
    } catch (fetchError) {
      setError(fetchError.message || "Nao foi possivel carregar o layout do dashboard.");
      notifyRef.current?.(fetchError.message, "danger");
    } finally {
      setLoading(false);
    }
  }, [token, canView]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (nextLayout) => {
      const result = await saveDashboardLayout(token, nextLayout);
      setLayout(result);
      return result;
    },
    [token]
  );

  const reset = useCallback(async () => {
    const result = await resetDashboardLayout(token);
    setLayout(result);
    return result;
  }, [token]);

  return { layout, loading, error, saveLayout: save, resetLayout: reset, reload: load };
}
