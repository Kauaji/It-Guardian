import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Search, Star } from "lucide-react";
import { FLOOR_PLAN_CATALOG } from "../floorPlanCatalog.js";
import FloorPlanObjectGlyph from "../FloorPlanObjectGlyph.jsx";
import RoomCatalog from "../rooms/RoomCatalog.jsx";
import { useCatalogFavorites } from "../hooks/useCatalogFavorites.js";
import { getCatalogSections, getPlacementHint, getVisibleCatalogItems } from "../utils/catalogView.js";

function CatalogItem({ item, isPending, isFavorite, showSection, onAddItem, onToggleFavorite }) {
  const Icon = item.icon || Info;
  const usesPlanGlyph = Boolean(item.objectType);
  return (
    <div className={`floor-plan-catalog-item-shell${isPending ? " placement-active" : ""}`}>
      <button className="floor-plan-catalog-item" type="button" onClick={() => onAddItem(item)} aria-pressed={isPending} title={`Posicionar ${item.label}`}>
        {usesPlanGlyph ? (
          <svg aria-hidden="true" className="floor-plan-catalog-object-preview" viewBox={`0 0 ${item.width} ${item.height}`}>
            <FloorPlanObjectGlyph object={item} width={item.width} height={item.height} />
          </svg>
        ) : (
          <Icon size={22} />
        )}
        <span>{item.label}</span>
        {showSection ? <small>{item.sectionLabel}</small> : null}
      </button>
      <button className={`floor-plan-catalog-favorite${isFavorite ? " active" : ""}`} type="button" onClick={() => onToggleFavorite(item.id)} title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-label={isFavorite ? `Remover ${item.label} dos favoritos` : `Adicionar ${item.label} aos favoritos`}>
        <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function CatalogHeader({ activeSection, query, collapsed, onQueryChange, onSelectSection, onToggleCollapsed }) {
  return (
    <header className="floor-plan-catalog-header">
      <nav aria-label="Catalogo da planta">
        {getCatalogSections(FLOOR_PLAN_CATALOG).map((entry) => (
          <button className={activeSection === entry.id ? "active" : ""} key={entry.id} type="button" onClick={() => onSelectSection(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>
      <div className="floor-plan-catalog-controls">
        <label className="floor-plan-catalog-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar em todo o catalogo" aria-label="Buscar item em todo o catalogo" />
        </label>
        <button className="icon-button" type="button" onClick={onToggleCollapsed} title={collapsed ? "Expandir catalogo" : "Recolher catalogo"} aria-label={collapsed ? "Expandir catalogo" : "Recolher catalogo"}>
          {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
    </header>
  );
}

export default function FloorPlanCatalog({ activeSection, onActiveSectionChange, onAddItem, onSelectRoomTemplate, placement, catalogRef }) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const { favoriteIds, toggleFavorite } = useCatalogFavorites();
  const { items, normalizedQuery } = getVisibleCatalogItems({ catalog: FLOOR_PLAN_CATALOG, activeSection, query, favoriteIds });

  const selectSection = (sectionId) => {
    onActiveSectionChange(sectionId);
    setCollapsed(false);
  };

  return (
    <section ref={catalogRef} className={`floor-plan-catalog${activeSection === "rooms" ? " room-catalog-active" : ""}${collapsed ? " collapsed" : ""}`}>
      <CatalogHeader
        activeSection={activeSection}
        query={query}
        collapsed={collapsed}
        onQueryChange={setQuery}
        onSelectSection={selectSection}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      {!collapsed && (activeSection === "rooms" && !normalizedQuery ? (
        <RoomCatalog onSelectTemplate={onSelectRoomTemplate} onAddItem={onAddItem} />
      ) : (
        <div className="floor-plan-catalog-items">
          {items.map((item) => (
            <CatalogItem
              key={item.id}
              item={item}
              isPending={placement?.kind === "catalog" && placement.item?.id === item.id}
              isFavorite={favoriteIds.includes(item.id)}
              showSection={Boolean(normalizedQuery)}
              onAddItem={onAddItem}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {!items.length ? <p className="floor-plan-catalog-empty">Nenhum item encontrado.</p> : null}
        </div>
      ))}
      {placement ? (
        <div className="floor-plan-catalog-hint" role="status" aria-live="polite">
          {getPlacementHint(placement)}
        </div>
      ) : null}
    </section>
  );
}
