import { useEffect, useState } from "react";
import { fetchProducts, fetchServices, fetchTechnicians } from "../../../../api.js";

// Tecnicos, pecas e servicos ativos usados na aba Atendimento.
export function useDetailCatalogs({ serviceOrder, token, notify }) {
  const [technicians, setTechnicians] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (!serviceOrder || !token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    fetchProducts(token)
      .then((response) => setProducts((response.products || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    fetchServices(token)
      .then((response) => setServices((response.services || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));
  }, [serviceOrder?.id, token]);

  return { technicians, products, services };
}
