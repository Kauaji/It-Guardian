import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPartCategories, fetchPartsInventory, syncPartsFromAssets } from "../../../api.js";
import { buildPartsQuery } from "../utils/partsModel.js";

// Pecas e categorias do servidor. A busca textual espera 220 ms; os demais filtros consultam de imediato.
export function usePartsData({ token, notify, search, inventoryState, discrepancyOnly }) {
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [partsData, categoriesData] = await Promise.all([
        fetchPartsInventory(token, buildPartsQuery({ search, inventoryState, discrepancyOnly })),
        fetchPartCategories(token)
      ]);
      setParts(partsData.parts || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setLoading(false);
    }
  }, [discrepancyOnly, inventoryState, notify, search, token]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 220 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return { parts, categories, loading, load };
}

// Concilia os ativos monitorados com o inventario uma unica vez por montagem (apenas com permissao).
export function useHardwareReconciliation({ token, notify, enabled, load }) {
  const reconciled = useRef(false);
  useEffect(() => {
    if (!enabled || reconciled.current) return;
    reconciled.current = true;
    syncPartsFromAssets(token)
      .then(({ summary }) => {
        if (summary.created || summary.discrepancies) load();
      })
      .catch((error) => notify?.(error.message, "danger"));
  }, [load, notify, enabled, token]);
}
