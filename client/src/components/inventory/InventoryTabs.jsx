import { Edit3, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

export default function InventoryTabs({
  tabs,
  activeTabId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onColorChange,
  activePopoverId,
  setActivePopoverId
}) {
  function renderTab(tab, active = false) {
    const rawLabel = tab.name?.trim() || "";
    const label = rawLabel || "Novo ambiente";
    const actionsMenuId = `tab-actions-${tab.id}`;
    const actionsOpen = activePopoverId === actionsMenuId;

    return (
      <article
        key={tab.id}
        className={`inventory-tab ${active ? "active" : ""}`}
        style={{ "--tab-color": tab.color || "#2563eb" }}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(tab.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onSelect(tab.id);
        }}
        title={label ? `Abrir ambiente ${label}` : "Abrir ambiente padrao"}
      >
        <span className="inventory-tab-dot" />
        <strong className={!label ? "empty-tab-label" : ""}>{label}</strong>
        {active && (
          <div className="inventory-tab-actions" onClick={(event) => event.stopPropagation()}>
            {actionsOpen && (
              <div className="inline-action-strip tab-inline-actions" onClick={(event) => event.stopPropagation()}>
                <ColorPickerSegment
                  color={tab.color}
                  onChange={(color) => onColorChange(tab.id, color)}
                  title="Alterar cor da aba"
                />
                <button
                  type="button"
                  className="inline-action-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRename(tab.id);
                    setActivePopoverId(null);
                  }}
                  title="Renomear aba"
                  aria-label="Renomear aba"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  type="button"
                  className="inline-action-button danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(tab.id);
                    setActivePopoverId(null);
                  }}
                  title="Excluir aba"
                  aria-label="Excluir aba"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              className="tab-options-trigger"
              onClick={(event) => {
                event.stopPropagation();
                setActivePopoverId(actionsOpen ? null : actionsMenuId);
              }}
              title="Ações da aba"
              aria-label="Ações da aba"
              aria-expanded={actionsOpen}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <section className="inventory-tabs-shell" aria-label="Ambientes do inventario">
      <div className="inventory-tabs-list">
        {tabs.map((tab) => renderTab(tab, tab.id === activeTabId))}
        <button type="button" className="inventory-tab-add" onClick={onCreate} title="Criar aba">
          <Plus size={17} />
        </button>
      </div>
    </section>
  );
}
