import RoomThumbnail from "./RoomThumbnail.jsx";
import { ROOM_TEMPLATES } from "../utils/roomTemplates.js";

export default function RoomCatalog({ onSelectTemplate }) {
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
    </div>
  );
}
