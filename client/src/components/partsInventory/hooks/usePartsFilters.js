import { useState } from "react";

// Filtros da lista: busca textual, disponibilidade e recorte de incongruencias abertas.
export function usePartsFilters() {
  const [search, setSearch] = useState("");
  const [inventoryState, setInventoryState] = useState("");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  return { search, setSearch, inventoryState, setInventoryState, discrepancyOnly, setDiscrepancyOnly };
}
