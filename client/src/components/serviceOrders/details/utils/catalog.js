import { normalizeSearchText } from "./text.js";

// Busca e selecao nos catalogos de produtos e servicos.

const SUGGESTION_LIMIT = 7;

export function filterProductSuggestions(products, search) {
  const term = normalizeSearchText(search);
  const source = term
    ? products.filter((product) =>
        normalizeSearchText(
          [product.name, product.category, product.brand, product.model, product.internalCode].filter(Boolean).join(" ")
        ).includes(term)
      )
    : products;

  return source.slice(0, SUGGESTION_LIMIT);
}

export function filterServiceSuggestions(services, search) {
  const term = normalizeSearchText(search);
  const source = term
    ? services.filter((service) => normalizeSearchText([service.name, service.category].filter(Boolean).join(" ")).includes(term))
    : services;

  return source.slice(0, SUGGESTION_LIMIT);
}

export function findProductByName(products, name) {
  return products.find((product) => normalizeSearchText(product.name) === normalizeSearchText(name));
}

export function findServiceByName(services, name) {
  return services.find((service) => normalizeSearchText(service.name) === normalizeSearchText(name));
}

/** Resumo "categoria - marca - modelo" mostrado nas sugestoes de produto. */
export function describeProduct(product) {
  return [product.category, product.brand, product.model].filter(Boolean).join(" - ");
}
