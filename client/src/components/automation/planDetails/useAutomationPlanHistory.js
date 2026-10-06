import { useEffect, useRef, useState } from "react";

// Carrega o historico do plano sob demanda (somente quando a aba Historico abre)
// e o descarta ao trocar de plano.
export default function useAutomationPlanHistory({ open, activeTab, planId, onLoadHistory }) {
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const onLoadHistoryRef = useRef(onLoadHistory);

  useEffect(() => {
    onLoadHistoryRef.current = onLoadHistory;
  }, [onLoadHistory]);

  useEffect(() => {
    setHistory([]);
  }, [planId]);

  useEffect(() => {
    if (!open || activeTab !== "history" || history.length || !onLoadHistoryRef.current) return;
    setHistoryLoading(true);
    onLoadHistoryRef
      .current(planId)
      .then((result) => setHistory(result?.items || []))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, history.length, open, planId]);

  return { history, historyLoading };
}
