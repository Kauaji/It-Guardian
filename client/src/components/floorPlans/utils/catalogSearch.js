export function normalizeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function searchCatalogItems(sections = [], query = "") {
  const normalizedQuery = normalizeCatalogSearch(query);
  if (!normalizedQuery) return [];

  return sections.flatMap((section) => (
    (section.items || []).map((item) => ({
      ...item,
      sectionId: section.id,
      sectionLabel: section.label
    }))
  )).filter((item) => {
    const searchableText = normalizeCatalogSearch([
      item.label,
      item.id,
      item.objectType,
      item.sectionLabel,
      ...(item.tags || [])
    ].filter(Boolean).join(" "));
    return searchableText.includes(normalizedQuery);
  });
}
