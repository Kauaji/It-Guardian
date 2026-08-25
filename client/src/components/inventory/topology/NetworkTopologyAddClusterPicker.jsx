import { FolderTree, Layers, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchCatalogItems } from "../../floorPlans/utils/catalogSearch.js";
import { getAggregateStatusColorToken, getAggregateStatusLabel } from "./networkTopologyHierarchy.js";

/**
 * Mesma lista buscavel de NetworkTopologyAddAssetPicker.jsx, so que pra
 * adicionar Segmentos/Grupos como no-cluster ao mapa (nivel Aba/Grupo) em
 * vez de Ativos ao mapa de um Segmento - reaproveita searchCatalogItems e as
 * mesmas classes CSS .network-topology-add-asset*.
 */
export default function NetworkTopologyAddClusterPicker({ items, onPick, disabled = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const sections = useMemo(
    () => [
      {
        id: "clusters",
        label: "Itens",
        items: items.map((item) => ({
          id: item.id,
          label: item.name,
          nodeType: item.nodeType,
          tags: []
        }))
      }
    ],
    [items]
  );

  const results = useMemo(() => {
    const entries = query.trim() ? searchCatalogItems(sections, query) : sections[0].items;
    return entries
      .map((entry) => ({ entry, item: items.find((candidate) => candidate.id === entry.id) }))
      .filter((row) => row.item);
  }, [sections, query, items]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  function handlePick(item) {
    onPick(item.nodeType, item.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="network-topology-add-asset" ref={containerRef}>
      <div className="network-topology-add-asset-input-wrap">
        <Search size={14} />
        <input
          ref={inputRef}
          type="search"
          className="network-topology-add-asset-input"
          placeholder="Adicionar grupo ou segmento ao mapa..."
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {open ? (
        <div className="network-topology-add-asset-popover" id={listId} role="listbox">
          {items.length === 0 ? (
            <p className="network-topology-add-asset-empty">Todos os grupos e segmentos já estão no mapa.</p>
          ) : results.length === 0 ? (
            <p className="network-topology-add-asset-empty">Nenhum item encontrado para "{query}".</p>
          ) : (
            results.map(({ entry, item }) => (
              <button
                type="button"
                key={item.id}
                className="network-topology-add-asset-item"
                role="option"
                disabled={disabled}
                onClick={() => handlePick(item)}
              >
                <span
                  className="network-topology-hierarchy-status-dot"
                  style={{ background: getAggregateStatusColorToken(item.status) }}
                />
                {item.nodeType === "group" ? <FolderTree size={16} /> : <Layers size={16} />}
                <span className="network-topology-add-asset-item-body">
                  <strong>{entry.label}</strong>
                  <span>
                    {item.nodeType === "group"
                      ? `${item.segmentCount} segmento(s) · ${item.deviceCount} ativo(s) · ${getAggregateStatusLabel(item.status)}`
                      : `${item.deviceCount} ativo(s) · ${getAggregateStatusLabel(item.status)}`}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
