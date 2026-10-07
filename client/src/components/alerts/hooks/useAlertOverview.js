import { useMemo } from "react";
import { buildAlertSummary, filterVisibleAlerts } from "../alertViewModel.js";

// Avisos filtrados pela Central (severidade/status) e indicadores do topo.
export default function useAlertOverview({ center, devices, lookups }) {
  const { alerts, history, suggestions, severityFilter, statusFilter } = center;
  const summary = useMemo(
    () => buildAlertSummary({ alerts, history, suggestions, devices, lookups }),
    [alerts, history, suggestions, devices, lookups]
  );

  return { visibleAlerts: filterVisibleAlerts(history, severityFilter, statusFilter), summary };
}
