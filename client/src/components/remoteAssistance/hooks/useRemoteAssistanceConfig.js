import { useEffect, useState } from "react";
import { fetchRemoteAssistanceConfig } from "../../../api.js";

// Configuracao do backend (habilitado, controle, intervalo do viewer, ICE).
// So consulta quando o botao poderia ser exibido para este tecnico/ativo.
export function useRemoteAssistanceConfig({ active, token }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!active || !token) return undefined;
    let cancelled = false;
    fetchRemoteAssistanceConfig(token)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, token]);

  return config;
}
