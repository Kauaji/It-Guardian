import { useEffect, useMemo, useState } from "react";
import { fetchClients, fetchSectors, fetchTechnicians } from "../../../../api.js";
import { generalSector, normalizeSectorList } from "../../serviceOrderBoardUtils.js";

// Setores, tecnicos e (modo Business) clientes usados nos filtros do quadro.
export function useBoardLookups({ token, businessMode }) {
  const [sectors, setSectors] = useState([generalSector]);
  const [clients, setClients] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const availableSectors = useMemo(() => normalizeSectorList(sectors), [sectors]);

  useEffect(() => {
    if (!token) return;

    fetchSectors(token)
      .then((response) => setSectors(normalizeSectorList(response.sectors || [])))
      .catch(() => setSectors([generalSector]));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch(() => setTechnicians([]));

    if (businessMode) {
      fetchClients(token)
        .then((response) => setClients((response.clients || []).filter((item) => item.active !== false)))
        .catch(() => setClients([]));
    } else {
      setClients([]);
    }
  }, [businessMode, token]);

  return { availableSectors, clients, technicians };
}
