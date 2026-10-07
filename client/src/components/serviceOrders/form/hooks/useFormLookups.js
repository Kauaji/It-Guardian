import { useEffect, useState } from "react";
import { fetchClients, fetchTechnicians } from "../../../../api.js";

// Tecnicos (sempre) e clientes (modo Business) ativos, carregados quando o formulario abre.
export function useFormLookups({ open, token, businessMode, notify }) {
  const [technicians, setTechnicians] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!open || !token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    if (businessMode) {
      fetchClients(token)
        .then((response) => setClients((response.clients || []).filter((item) => item.active !== false)))
        .catch((error) => notify?.(error.message, "danger"));
    } else {
      setClients([]);
    }
  }, [businessMode, open, token]);

  return { technicians, clients };
}
