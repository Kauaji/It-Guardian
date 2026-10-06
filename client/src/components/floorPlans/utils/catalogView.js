import { normalizeCatalogSearch, searchCatalogItems } from "./catalogSearch.js";

export const FAVORITES_STORAGE_KEY = "it-guardian-floor-plan-favorites";

const ROOMS_SECTION = { id: "rooms", label: "Cômodos" };

/** Abas do catalogo: "Comodos" (modelos de comodo) + categorias de itens. */
export function getCatalogSections(catalog) {
  return [ROOMS_SECTION, ...catalog];
}

/**
 * Itens exibidos no catalogo: resultado da busca global ou os itens da aba
 * ativa, com os favoritos primeiro.
 */
export function getVisibleCatalogItems({ catalog, activeSection, query, favoriteIds }) {
  const section = catalog.find((entry) => entry.id === activeSection) || catalog[0];
  const normalizedQuery = normalizeCatalogSearch(query);
  const searchableItems = normalizedQuery
    ? searchCatalogItems(catalog, query)
    : (section.items || []).map((item) => ({ ...item, sectionLabel: section.label }));
  const items = searchableItems.sort((left, right) => Number(favoriteIds.includes(right.id)) - Number(favoriteIds.includes(left.id)));
  return { items, normalizedQuery };
}

/** Texto de apoio mostrado no catalogo enquanto ha um posicionamento pendente. */
export function getPlacementHint(placement) {
  if (placement.kind === "room") return "Defina a área do cômodo";
  if (placement.kind === "wall") return "Marque o início e o fim";
  if (placement.kind === "opening") return "Selecione uma parede";
  return `Clique na planta para posicionar ${placement.item?.label || "o item"}. Esc cancela`;
}

/** Le os favoritos salvos (lista vazia se o armazenamento falhar ou estiver corrompido). */
export function readStoredFavorites(getStorage = () => window.localStorage) {
  try {
    return JSON.parse(getStorage().getItem(FAVORITES_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function toggleFavoriteId(current, itemId) {
  return current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId];
}
