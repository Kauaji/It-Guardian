import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProductKeyActivations, fetchProductKeys } from "../../../api.js";

/** Lista de chaves e a chave selecionada (expandida). */
export function useProductKeys(token) {
  const [productKeys, setProductKeys] = useState([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");

  const selectedKey = useMemo(() => productKeys.find((item) => item.id === selectedKeyId) || null, [productKeys, selectedKeyId]);

  const loadProductKeys = useCallback(async () => {
    const response = await fetchProductKeys(token);
    const items = response.productKeys || [];
    setProductKeys(items);
    setSelectedKeyId((current) => (current && items.some((item) => item.id === current) ? current : ""));
  }, [token]);

  return { productKeys, selectedKeyId, setSelectedKeyId, selectedKey, loadProductKeys };
}

/** Computadores ativados da chave selecionada; recarrega ao trocar a seleção. */
export function useKeyActivations({ token, selectedKeyId, showMessage, setBusyAction }) {
  const [activations, setActivations] = useState([]);

  useEffect(() => {
    if (!selectedKeyId) {
      setActivations([]);
      return;
    }
    let active = true;
    setBusyAction(`activations:${selectedKeyId}`);
    fetchProductKeyActivations(token, selectedKeyId)
      .then((response) => {
        if (active) setActivations(response.activations || []);
      })
      .catch((error) => {
        if (active) showMessage(error.message, "danger");
      })
      .finally(() => {
        if (active) {
          setBusyAction((current) => (current === `activations:${selectedKeyId}` ? "" : current));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedKeyId, showMessage, token]);

  return { activations, setActivations };
}
