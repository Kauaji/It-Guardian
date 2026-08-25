import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchCatalogItems } from "../../floorPlans/utils/catalogSearch.js";
import { assetTypeLabel } from "../assetTypes.js";
import AssetTypeIcon from "../AssetTypeIcon.jsx";
import PulseDot from "../../ui/PulseDot.jsx";
import { resolveAssetType, resolveNodeStatusTone } from "./networkTopologyModel.js";

/**
 * Substitui o <select> antigo de "adicionar ativo ao mapa" por uma lista
 * buscavel (mesma utilidade de busca ja usada no catalogo da Planta Baixa,
 * catalogSearch.js - sem reescrever a logica de filtro). Sem query digitada
 * mostra todos os disponiveis, ja que aqui o ponto e navegar/escolher, nao
 * so buscar um item ja conhecido de cor.
 */
export default function NetworkTopologyAddAssetPicker({ devices, onPick, disabled = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const sections = useMemo(
    () => [
      {
        id: "devices",
        label: "Ativos",
        items: devices.map((device) => ({
          id: device.id,
          label: device.name || device.id,
          objectType: resolveAssetType(device),
          tags: [device.ip, device.technicalName].filter(Boolean)
        }))
      }
    ],
    [devices]
  );

  const results = useMemo(() => {
    const items = query.trim() ? searchCatalogItems(sections, query) : sections[0].items;
    return items
      .map((item) => ({ item, device: devices.find((device) => device.id === item.id) }))
      .filter((entry) => entry.device);
  }, [sections, query, devices]);

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

  function handlePick(deviceId) {
    onPick(deviceId);
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
          placeholder="Adicionar ativo ao mapa..."
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
          {devices.length === 0 ? (
            <p className="network-topology-add-asset-empty">Todos os ativos já estão no mapa.</p>
          ) : results.length === 0 ? (
            <p className="network-topology-add-asset-empty">Nenhum ativo encontrado para "{query}".</p>
          ) : (
            results.map(({ item, device }) => (
              <button
                type="button"
                key={item.id}
                className="network-topology-add-asset-item"
                role="option"
                disabled={disabled}
                onClick={() => handlePick(item.id)}
              >
                <PulseDot tone={resolveNodeStatusTone(device)} />
                <AssetTypeIcon type={item.objectType} size={16} />
                <span className="network-topology-add-asset-item-body">
                  <strong>{item.label}</strong>
                  <span>
                    {[device.ip, device.technicalName !== item.label ? device.technicalName : null, assetTypeLabel(item.objectType)]
                      .filter(Boolean)
                      .join(" · ")}
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
