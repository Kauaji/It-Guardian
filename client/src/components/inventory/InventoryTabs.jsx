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
    const label = tab.id === "tab-default" && rawLabel === "Sem nome" ? "" : rawLabel;
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
            <button
              type="button"
              className="tab-options-trigger"
              onClick={() => setActivePopoverId(actionsOpen ? null : actionsMenuId)}
              title="Acoes da aba"
              aria-label="Acoes da aba"
              aria-expanded={actionsOpen}
            >
              <MoreHorizontal size={15} />
            </button>
            {actionsOpen && (
              <div className="action-menu-popover tab-actions-menu" onClick={(event) => event.stopPropagation()}>
                <div className="action-menu-item color-action" role="group" aria-label="Cor da aba">
                  <span>Cor</span>
                  <ColorPickerSegment
                    color={tab.color}
                    onChange={(color) => onColorChange(tab.id, color)}
                    title="Alterar cor da aba"
                  />
                </div>
                <button
                  type="button"
                  className="action-menu-item"
                  onClick={() => {
                    onRename(tab.id);
                    setActivePopoverId(null);
                  }}
                >
                  <Edit3 size={14} />
                  Renomear aba
                </button>
                <button
                  type="button"
                  className="action-menu-item danger"
                  onClick={() => {
                    onDelete(tab.id);
                    setActivePopoverId(null);
                  }}
                >
                  <Trash2 size={14} />
                  Excluir aba
                </button>
              </div>
            )}
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
