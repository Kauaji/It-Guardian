import { useEffect, useState } from "react";
import { fetchMaintenanceScriptRecommendations, fetchServiceOrderScriptActivity } from "../../../../api.js";
import { ACTIVE_POLL_INTERVAL_MS, ACTIVE_POLL_MAX_ATTEMPTS, buildRecommendationContext, hasActiveJob } from "../utils/scriptRules.js";

// Carrega atividade e recomendacoes da OS e atualiza a atividade enquanto ha job ativo.
export function useScriptCatalog({ serviceOrder, token, notify }) {
  const [activity, setActivity] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const serviceOrderId = serviceOrder?.id;
  const hasAsset = Boolean(serviceOrder?.assetId);

  function loadActivity() {
    if (!serviceOrderId || !token) return;
    fetchServiceOrderScriptActivity(token, serviceOrderId)
      .then((response) => setActivity(response.activity || []))
      .catch((error) => notify?.(error.message, "danger"));
  }

  useEffect(() => {
    if (!serviceOrderId || !token) return;
    setLoading(true);
    const context = buildRecommendationContext(serviceOrder);
    Promise.all([
      fetchServiceOrderScriptActivity(token, serviceOrderId),
      hasAsset
        ? fetchMaintenanceScriptRecommendations(token, { assetIds: [serviceOrder.assetId], context })
        : Promise.resolve({ recommended: [], others: [] })
    ])
      .then(([activityResponse, recommendationResponse]) => {
        setActivity(activityResponse.activity || []);
        setRecommended(recommendationResponse.recommended || []);
        setOthers(recommendationResponse.others || []);
      })
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [serviceOrderId, token, notify]);

  const activeJob = hasActiveJob(activity);

  useEffect(() => {
    if (!activeJob || !serviceOrderId || !token) return undefined;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      loadActivity();
      if (attempts >= ACTIVE_POLL_MAX_ATTEMPTS) clearInterval(timer);
    }, ACTIVE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeJob, serviceOrderId, token]);

  return { activity, recommended, others, loading, loadActivity };
}
