import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReportPreview } from "../api.js";

/**
 * Modelado em useDashboardSummary.js, mas sem auto-refresh: relatorio e
 * gerado sob demanda (o usuario escolhe filtros e pede o preview), nao um
 * painel que precisa ficar se atualizando sozinho.
 */
export function useReportData({ token, type, filters, canView, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const filtersKey = JSON.stringify(filters || {});

  const load = useCallback(async () => {
    if (!token || !type || !canView) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchReportPreview(token, type, JSON.parse(filtersKey));
      setData(result);
      setError("");
    } catch (fetchError) {
      setError(fetchError.message || "Nao foi possivel carregar o relatorio.");
      notifyRef.current?.(fetchError.message, "danger");
    } finally {
      setLoading(false);
    }
  }, [token, type, canView, filtersKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
