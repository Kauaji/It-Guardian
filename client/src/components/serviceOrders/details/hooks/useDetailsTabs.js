import { useEffect, useState } from "react";

// Aba ativa do detalhe; volta para "Geral" ao trocar de OS.
export function useDetailsTabs(serviceOrder) {
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (!serviceOrder) return;
    setActiveTab("general");
  }, [serviceOrder?.id]);

  return { activeTab, setActiveTab };
}
