import RoomThumbnail from "./RoomThumbnail.jsx";
import { ROOM_TEMPLATES } from "../utils/roomTemplates.js";
import { FLOOR_PLAN_DIVIDER_ITEM } from "../floorPlanCatalog.js";

export default function RoomCatalog({ onSelectTemplate, onAddItem }) {
  const DividerIcon = FLOOR_PLAN_DIVIDER_ITEM.icon;

  return (
    <div className="room-catalog-grid">
      {ROOM_TEMPLATES.map((template) => {
        const Icon = template.icon;
        return (
          <button key={template.id} type="button" onClick={() => onSelectTemplate(template)} className="room-catalog-card">
            <RoomThumbnail template={template} />
            <span>
              <Icon size={15} />
              {template.label}
            </span>
            <small>{template.category}</small>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onAddItem(FLOOR_PLAN_DIVIDER_ITEM)}
        className="room-catalog-card room-divider-card"
      >
        <span className="room-divider-thumbnail" aria-hidden="true">
          <i />
        </span>
        <span>
          <DividerIcon size={15} />
          {FLOOR_PLAN_DIVIDER_ITEM.label}
        </span>
        <small>Estrutura interna</small>
      </button>
    </div>
  );
}
