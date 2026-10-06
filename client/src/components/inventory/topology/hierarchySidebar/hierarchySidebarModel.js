import { searchCatalogItems } from "../../../floorPlans/utils/catalogSearch.js";

// Secoes pesquisaveis (grupos e segmentos) da arvore da hierarquia.
export function buildSearchSections(tree) {
  return [
    {
      id: "groups",
      label: "Grupos",
      items: tree.groups.map((group) => ({ id: group.id, label: group.name, tags: ["grupo"] }))
    },
    {
      id: "segments",
      label: "Segmentos",
      items: [
        ...tree.groups.flatMap((group) =>
          group.segments.map((segment) => ({ id: segment.id, label: segment.name, tags: ["segmento", group.name] }))
        ),
        ...tree.ungroupedSegments.map((segment) => ({ id: segment.id, label: segment.name, tags: ["segmento"] }))
      ]
    }
  ];
}

// Aplica a busca a arvore: ids casados e as listas de grupos/segmentos visiveis.
export function filterHierarchy(tree, sections, query) {
  const searchResults = query.trim() ? searchCatalogItems(sections, query) : null;
  const matchedGroupIds = searchResults
    ? new Set(searchResults.filter((item) => item.sectionId === "groups").map((item) => item.id))
    : null;
  const matchedSegmentIds = searchResults
    ? new Set(searchResults.filter((item) => item.sectionId === "segments").map((item) => item.id))
    : null;
  const visibleGroups = matchedGroupIds
    ? tree.groups.filter((group) => matchedGroupIds.has(group.id) || group.segments.some((segment) => matchedSegmentIds.has(segment.id)))
    : tree.groups;
  const visibleUngrouped = matchedSegmentIds
    ? tree.ungroupedSegments.filter((segment) => matchedSegmentIds.has(segment.id))
    : tree.ungroupedSegments;
  return { matchedGroupIds, matchedSegmentIds, visibleGroups, visibleUngrouped };
}

// Copia o conjunto alternando a presenca do id.
export function toggleInSet(current, id) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
