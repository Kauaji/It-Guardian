import { useEffect, useState } from "react";
import { fetchMaintenanceScriptRecommendations } from "../../../api.js";

const emptyRecommendations = { recommended: [], others: [], loading: false, error: "" };

// Recomendacoes de scripts para as maquinas selecionadas. Sem selecao (ou sem
// token) o estado volta ao vazio; em erro, oferece todos os scripts ativos.
export default function usePreventiveScriptRecommendations({ token, assetIds, activeScripts }) {
  const [recommendations, setRecommendations] = useState(emptyRecommendations);
  const assetKey = assetIds.join("|");

  useEffect(() => {
    if (!token || !assetIds.length) {
      setRecommendations((current) => {
        if (
          !current.loading &&
          !current.error &&
          current.recommended.length === 0 &&
          current.others.length === 0
        ) {
          return current;
        }
        return emptyRecommendations;
      });
      return undefined;
    }

    let ignore = false;
    setRecommendations((current) => ({ ...current, loading: true, error: "" }));

    fetchMaintenanceScriptRecommendations(token, {
      assetIds,
      context: { source: "preventive_plan" }
    })
      .then((result) => {
        if (ignore) return;
        setRecommendations({
          recommended: result?.recommended || [],
          others: result?.others || [],
          loading: false,
          error: ""
        });
      })
      .catch((error) => {
        if (ignore) return;
        setRecommendations({
          recommended: [],
          others: activeScripts,
          loading: false,
          error: error.message || "Não foi possível carregar recomendações."
        });
      });

    return () => {
      ignore = true;
    };
  }, [activeScripts, token, assetKey]);

  return [recommendations, () => setRecommendations(emptyRecommendations)];
}
