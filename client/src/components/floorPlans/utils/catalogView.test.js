import { describe, expect, it } from "vitest";
import {
  FAVORITES_STORAGE_KEY,
  getCatalogSections,
  getPlacementHint,
  getVisibleCatalogItems,
  readStoredFavorites,
  toggleFavoriteId
} from "./catalogView.js";

const catalog = [
  {
    id: "furniture",
    label: "Móveis",
    items: [
      { id: "desk", label: "Mesa" },
      { id: "chair", label: "Cadeira" }
    ]
  },
  {
    id: "it",
    label: "TI",
    items: [
      { id: "pc", label: "Computador", tags: ["desktop"] },
      { id: "rack", label: "Rack" }
    ]
  }
];

describe("getCatalogSections", () => {
  it("antepoe a aba de comodos", () => {
    expect(getCatalogSections(catalog).map((section) => section.id)).toEqual(["rooms", "furniture", "it"]);
  });
});

describe("getVisibleCatalogItems", () => {
  it("lista os itens da aba ativa com o rotulo da secao", () => {
    const { items, normalizedQuery } = getVisibleCatalogItems({ catalog, activeSection: "it", query: "", favoriteIds: [] });
    expect(normalizedQuery).toBe("");
    expect(items.map((item) => item.id)).toEqual(["pc", "rack"]);
    expect(items[0].sectionLabel).toBe("TI");
  });

  it("usa a primeira categoria quando a aba ativa nao e de itens", () => {
    const { items } = getVisibleCatalogItems({ catalog, activeSection: "rooms", query: "", favoriteIds: [] });
    expect(items.map((item) => item.id)).toEqual(["desk", "chair"]);
  });

  it("busca em todo o catalogo sem diferenca de acento ou caixa", () => {
    const { items, normalizedQuery } = getVisibleCatalogItems({
      catalog,
      activeSection: "furniture",
      query: "  COMPUTADOR ",
      favoriteIds: []
    });
    expect(normalizedQuery).toBe("computador");
    expect(items.map((item) => item.id)).toEqual(["pc"]);
  });

  it("coloca os favoritos primeiro", () => {
    const { items } = getVisibleCatalogItems({ catalog, activeSection: "furniture", query: "", favoriteIds: ["chair"] });
    expect(items.map((item) => item.id)).toEqual(["chair", "desk"]);
  });
});

describe("getPlacementHint", () => {
  it("descreve o proximo passo de cada tipo de posicionamento", () => {
    expect(getPlacementHint({ kind: "room" })).toBe("Defina a área do cômodo");
    expect(getPlacementHint({ kind: "wall" })).toBe("Marque o início e o fim");
    expect(getPlacementHint({ kind: "opening" })).toBe("Selecione uma parede");
    expect(getPlacementHint({ kind: "catalog", item: { label: "Mesa" } })).toBe("Clique na planta para posicionar Mesa. Esc cancela");
    expect(getPlacementHint({ kind: "catalog" })).toBe("Clique na planta para posicionar o item. Esc cancela");
  });
});

describe("favoritos", () => {
  it("le a lista salva e tolera falhas do armazenamento", () => {
    const storage = { getItem: (name) => (name === FAVORITES_STORAGE_KEY ? '["a","b"]' : null) };
    expect(readStoredFavorites(() => storage)).toEqual(["a", "b"]);
    expect(readStoredFavorites(() => ({ getItem: () => null }))).toEqual([]);
    expect(readStoredFavorites(() => ({ getItem: () => "{corrompido" }))).toEqual([]);
    expect(
      readStoredFavorites(() => {
        throw new Error("bloqueado");
      })
    ).toEqual([]);
  });

  it("alterna um favorito", () => {
    expect(toggleFavoriteId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleFavoriteId(["a", "b"], "a")).toEqual(["b"]);
  });
});
