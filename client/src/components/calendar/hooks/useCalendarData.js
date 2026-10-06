import { useCallback, useEffect, useState } from "react";
import { fetchCalendarEvents, fetchCalendarSummary, fetchTechnicians } from "../../../api.js";
import { buildQueryParams } from "../utils/calendarPage.js";

// Carrega eventos, resumo e tecnicos do periodo; `load` tambem serve para recarregar apos uma acao.
export function useCalendarData({ token, notify, range, filters }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = buildQueryParams(range, filters);
    try {
      const [eventData, summaryData, technicianData] = await Promise.all([
        fetchCalendarEvents(token, params),
        fetchCalendarSummary(token, params),
        fetchTechnicians(token)
      ]);
      setEvents(eventData.events || []);
      setSummary(summaryData.summary || {});
      setTechnicians(technicianData.technicians || []);
    } catch (error) {
      notify?.(error.message || "Não foi possível carregar a agenda.", "danger");
    } finally {
      setLoading(false);
    }
  }, [filters, notify, range, token]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, summary, technicians, loading, load };
}
