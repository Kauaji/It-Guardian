import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useState } from "react";
import WidgetBody from "./WidgetBody.jsx";
import WidgetChrome from "./WidgetChrome.jsx";
import { widgetRegistry } from "./widgetRegistry.js";
import { reindexWidgetPositions, sortWidgetsByPosition } from "./widgetGridMath.js";

/**
 * DndContext proprio, aninhado dentro do DndContext do shell do app (que
 * cuida do drag-and-drop do Inventario) -- dnd-kit suporta contextos
 * aninhados como superficies de arrastar independentes, entao um arrasto
 * aqui nunca interfere no do Inventario e vice-versa.
 */
export default function WidgetGrid({ token, widgets, editing, arranging, onReorder, onRemove, onResize, onConfigure }) {
  const [openMenuWidgetId, setOpenMenuWidgetId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ordered = sortWidgetsByPosition(widgets);

  useEffect(() => {
    if (!editing) setOpenMenuWidgetId(null);
  }, [editing]);

  useEffect(() => {
    function closeOpenMenu(event) {
      if (event.key === "Escape" || (event.type === "pointerdown" && !event.target.closest?.(".dashboard-widget-menu"))) {
        setOpenMenuWidgetId(null);
      }
    }

    document.addEventListener("pointerdown", closeOpenMenu);
    document.addEventListener("keydown", closeOpenMenu);
    return () => {
      document.removeEventListener("pointerdown", closeOpenMenu);
      document.removeEventListener("keydown", closeOpenMenu);
    };
  }, []);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((widget) => widget.id === active.id);
    const newIndex = ordered.findIndex((widget) => widget.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(reindexWidgetPositions(arrayMove(ordered, oldIndex, newIndex)));
  }

  if (!ordered.length) {
    return (
      <p className="dashboard-empty-state dashboard-widget-grid-empty">
        Nenhum widget neste dashboard ainda. Use &quot;Adicionar widget&quot; para comecar.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        <div className="dashboard-widget-grid">
          {ordered.map((widget) => (
            <WidgetChrome
              key={widget.id}
              widget={widget}
              editing={editing}
              arranging={arranging}
              menuOpen={openMenuWidgetId === widget.id}
              onToggleMenu={() => setOpenMenuWidgetId((current) => current === widget.id ? null : widget.id)}
              onCloseMenu={() => setOpenMenuWidgetId(null)}
              label={widget.title || widgetRegistry[widget.type]?.label || widget.type}
              onRemove={() => onRemove(widget.id)}
              onResize={(sizePatch) => onResize(widget.id, sizePatch)}
              onConfigure={() => onConfigure(widget)}
            >
              <WidgetBody token={token} widget={widget} />
            </WidgetChrome>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
