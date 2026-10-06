import { MoreHorizontal } from "lucide-react";
import GroupActionStrip from "./GroupActionStrip.jsx";
import { pluralizeSegments } from "./boardProps.js";

export default function BoardGroupHeader({ group, groupIndex, groupCount, activeTab, activePopoverId, setActivePopoverId, canManage, groupActions }) {
  const popoverId = `group-actions-${group.id}`;
  return (
    <header>
      <div className="group-header-main">
        <span className="segment-filter-dot group" style={{ backgroundColor: group.color || activeTab?.color || "#8b9bb0" }} />
        <div className="group-title-copy">
          <strong>{group.name}</strong>
          <span>{pluralizeSegments(group.segments.length)}</span>
        </div>
      </div>
      <div className="group-header-actions">
        {activePopoverId === popoverId && (
          <GroupActionStrip
            group={group}
            groupIndex={groupIndex}
            groupCount={groupCount}
            activeTab={activeTab}
            canManage={canManage}
            setActivePopoverId={setActivePopoverId}
            {...groupActions}
          />
        )}
        <button
          type="button"
          className="group-icon-action group-options-trigger"
          onClick={(event) => {
            event.stopPropagation();
            setActivePopoverId(activePopoverId === popoverId ? null : popoverId);
          }}
          title="Ações do grupo"
          aria-label="Ações do grupo"
          aria-expanded={activePopoverId === popoverId}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </header>
  );
}
