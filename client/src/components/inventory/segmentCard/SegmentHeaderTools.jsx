import { ChevronDown, MoreHorizontal } from "lucide-react";
import SegmentActionStrip from "./SegmentActionStrip.jsx";

export default function SegmentHeaderTools({
  isDefaultSegment, collapsed, actionsOpen, actionsMenuId, setActivePopoverId, onToggleCollapsed, stripProps
}) {
  if (isDefaultSegment) {
    return (
      <div className="segment-header-tools">
        <button
          type="button"
          className={`segment-collapse ${collapsed ? "collapsed" : ""}`}
          title={collapsed ? "Expandir segmento" : "Recolher segmento"}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }
  return (
    <div className="segment-header-tools">
      <div className="segment-actions-menu-wrap">
        {actionsOpen && <SegmentActionStrip collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} {...stripProps} />}
        <button
          type="button"
          className="segment-options-trigger"
          title="Ações do segmento"
          aria-label="Ações do segmento"
          aria-expanded={actionsOpen}
          onClick={(event) => {
            event.stopPropagation();
            setActivePopoverId(actionsOpen ? null : actionsMenuId);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
