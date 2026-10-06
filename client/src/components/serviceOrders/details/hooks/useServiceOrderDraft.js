import { useEffect, useMemo, useState } from "react";
import { buildDraft, normalizeItems, sumItems } from "../utils/items.js";
import { parseCurrency } from "../utils/money.js";

// Rascunho editavel do atendimento e os totais derivados dos itens.
export function useServiceOrderDraft(serviceOrder) {
  const [draft, setDraft] = useState(() => buildDraft(serviceOrder));

  useEffect(() => {
    if (!serviceOrder) return;
    setDraft(buildDraft(serviceOrder));
  }, [serviceOrder?.id]);

  const serviceItems = useMemo(() => normalizeItems(draft.items), [draft.items]);
  const serviceValueNumber = useMemo(() => parseCurrency(draft.serviceValue), [draft.serviceValue]);
  const partsTotal = useMemo(() => sumItems(serviceItems), [serviceItems]);
  const totalValue = serviceValueNumber + partsTotal;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return { draft, setDraft, updateDraft, serviceItems, serviceValueNumber, partsTotal, totalValue };
}
