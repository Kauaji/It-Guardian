import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { HEIGHT_TIERS, WIDTH_TIERS, widgetGridStyle } from "./widgetGridMath.js";

const widthTierLabels = { s: "P", m: "M", l: "G", xl: "Largo" };
const heightTierLabels = { s: "P", m: "M", l: "G" };

/**
 * Chrome comum a todo widget (titulo, alca de arrastar, menu de
 * configurar/redimensionar/remover) -- so aparece fora do modo de edicao o
 * titulo, o corpo real fica limpo. Redimensionar e por tier discreto (P/M/G/
 * Largo), nao drag de pixel livre.
 */
export default function WidgetChrome({ widget, editing, label, onRemove, onConfigure, onResize, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const style = {
    ...widgetGridStyle(widget),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <article ref={setNodeRef} style={style} data-widget-type={widget.type} data-width={widget.w || "m"} data-height={widget.h || "s"} aria-label={label} className={`dashboard-widget-card ${editing ? "editing" : ""}`}>
      <header className="dashboard-widget-card-header">
        {editing && (
          <button
            type="button"
            className="dashboard-widget-drag-handle"
            title="Mover widget"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
        )}
        <h4 title={label}>{label}</h4>
        {editing && (
          <div className="dashboard-widget-menu">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMenuOpen((value) => !value)}
              title="Opcoes do widget"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="dashboard-widget-menu-panel" role="menu">
                {onConfigure && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onConfigure();
                    }}
                  >
                    <Settings size={14} /> Configurar
                  </button>
                )}
                <fieldset className="dashboard-widget-size-picker">
                  <legend>Largura</legend>
                  {WIDTH_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={widget.w === tier ? "active" : ""}
                      onClick={() => onResize({ w: tier })}
                    >
                      {widthTierLabels[tier]}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="dashboard-widget-size-picker">
                  <legend>Altura</legend>
                  {HEIGHT_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={widget.h === tier ? "active" : ""}
                      onClick={() => onResize({ h: tier })}
                    >
                      {heightTierLabels[tier]}
                    </button>
                  ))}
                </fieldset>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                >
                  <Trash2 size={14} /> Remover
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <div className="dashboard-widget-card-body">{children}</div>
    </article>
  );
}
