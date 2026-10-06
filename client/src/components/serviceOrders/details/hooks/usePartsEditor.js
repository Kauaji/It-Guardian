import { useEffect, useMemo, useState } from "react";
import { filterProductSuggestions, findProductByName } from "../utils/catalog.js";
import { appendPart, buildPartItem, emptyPartDraft, normalizeItems } from "../utils/items.js";
import { getProductPrice } from "../utils/money.js";

const SUGGESTION_CLOSE_DELAY_MS = 120;

// Pecas trocadas: busca no catalogo, sugestoes, rascunho da peca e lista de itens.
export function usePartsEditor({ serviceOrder, products, setDraft }) {
  const [partDraft, setPartDraft] = useState(emptyPartDraft);
  const [search, setSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!serviceOrder) return;
    setPartDraft(emptyPartDraft);
    setSearch("");
    setSuggestionsOpen(false);
    setOpen(false);
  }, [serviceOrder?.id]);

  const suggestions = useMemo(() => filterProductSuggestions(products, search), [products, search]);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === partDraft.productId) || findProductByName(products, search) || null,
    [products, partDraft.productId, search]
  );

  function toggleOpen() {
    setOpen((current) => !current);
  }

  function changeSearch(value) {
    setSearch(value);
    setSuggestionsOpen(true);
    setPartDraft((current) => ({ ...current, productId: "" }));
  }

  function openSuggestions() {
    setSuggestionsOpen(true);
  }

  function closeSuggestionsSoon() {
    window.setTimeout(() => setSuggestionsOpen(false), SUGGESTION_CLOSE_DELAY_MS);
  }

  function changeQuantity(quantity) {
    setPartDraft((current) => ({ ...current, quantity }));
  }

  function changeUnitPrice(unitPrice) {
    setPartDraft((current) => ({ ...current, unitPrice }));
  }

  function selectProduct(productId) {
    const product = products.find((item) => item.id === productId);
    setPartDraft((current) => ({
      ...current,
      productId,
      unitPrice: product ? String(getProductPrice(product)) : current.unitPrice
    }));
    setSearch(product?.name || "");
    setSuggestionsOpen(false);
  }

  function addPart() {
    const product = products.find((item) => item.id === partDraft.productId) || findProductByName(products, search);
    const manualProductName = search.trim();
    if (!product && !manualProductName) return;

    const item = buildPartItem({ product, manualProductName, partDraft });
    setDraft((current) => appendPart(current, item));
    setPartDraft(emptyPartDraft);
    setSearch("");
  }

  function removePart(itemId) {
    setDraft((current) => ({
      ...current,
      items: normalizeItems(current.items).filter((item) => item.id !== itemId)
    }));
  }

  return {
    open,
    search,
    partDraft,
    suggestionsOpen,
    suggestions,
    selectedProduct,
    toggleOpen,
    changeSearch,
    openSuggestions,
    closeSuggestionsSoon,
    changeQuantity,
    changeUnitPrice,
    selectProduct,
    addPart,
    removePart
  };
}
