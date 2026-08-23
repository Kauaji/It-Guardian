import { useEffect, useRef, useState } from "react";
import { fetchDeviceMetricHistory } from "../../../api.js";
import { cacheKey, getCached, setCached } from "./metricHistoryCache.js";

/**
 * So busca quando `enabled` (popover aberto ou modal aberto) - nunca no
 * carregamento do quadro do Inventario inteiro. Cache curto evita refetch
 * em hover repetido; AbortController cancela ao desmontar ou trocar de
 * periodo, para uma resposta lenta de um periodo antigo nao sobrescrever
 * uma resposta rapida de um periodo mais novo.
 */
export function useMetricHistory({ token, deviceId, metric, period, enabled }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !token || !deviceId) {
      setLoading(false);
      return undefined;
    }

    const key = cacheKey(deviceId, metric, period);
    const cached = getCached(key);
    if (cached) {
      setData(cached);
      setError("");
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");

    fetchDeviceMetricHistory(token, deviceId, { metric, period }, { signal: controller.signal })
      .then((result) => {
        setCached(key, result);
        setData(result);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Nao foi possivel carregar o historico da metrica.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [enabled, token, deviceId, metric, period]);

  return { data, loading, error };
}
