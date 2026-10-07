import { useCallback, useState } from "react";
import { FAVORITES_STORAGE_KEY, readStoredFavorites, toggleFavoriteId } from "../utils/catalogView.js";

/** Favoritos do catalogo, persistidos no navegador (ignora falhas de armazenamento). */
export function useCatalogFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(() => readStoredFavorites());

  const toggleFavorite = useCallback((itemId) => {
    setFavoriteIds((current) => {
      const next = toggleFavoriteId(current, itemId);
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Sem armazenamento disponivel: os favoritos valem apenas nesta sessao.
      }
      return next;
    });
  }, []);

  return { favoriteIds, toggleFavorite };
}
