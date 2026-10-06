import { Database } from "lucide-react";
import SegmentCard from "../SegmentCard.jsx";
import BoardGroupHeader from "./BoardGroupHeader.jsx";
import SegmentGroupContainer from "./SegmentGroupContainer.jsx";
import { pluralizeSegments } from "./boardProps.js";

function BoardSegmentCard({ segment, machinesBySegment, cardProps, ...extra }) {
  return <SegmentCard segment={segment} machines={machinesBySegment.get(segment.id) || []} {...cardProps} {...extra} />;
}

function GroupSection({ group, groupIndex, groupCount, shared }) {
  const { activeTab, machinesBySegment, cardProps, selectedSegmentIds } = shared;
  return (
    <SegmentGroupContainer groupId={group.id} color={group.color || activeTab?.color}>
      <BoardGroupHeader
        group={group}
        groupIndex={groupIndex}
        groupCount={groupCount}
        activeTab={activeTab}
        activePopoverId={cardProps.activePopoverId}
        setActivePopoverId={cardProps.setActivePopoverId}
        canManage={cardProps.canManage}
        groupActions={shared.groupActions}
      />
      {!group.collapsed && (
        group.segments.length ? group.segments.map((segment, segmentIndex) => (
          <BoardSegmentCard
            key={segment.id}
            segment={segment}
            machinesBySegment={machinesBySegment}
            cardProps={cardProps}
            canMoveSegmentUp={segmentIndex > 0}
            canMoveSegmentDown={segmentIndex < group.segments.length - 1}
            selected={selectedSegmentIds.has(segment.id)}
          />
        )) : (
          <div className="segment-group-empty">
            <strong>Grupo vazio</strong>
            <span>Use o seletor "Sem grupo" no cabeçalho de um segmento para mover ele para cá.</span>
          </div>
        )
      )}
    </SegmentGroupContainer>
  );
}

function UngroupedSection({ segments, shared }) {
  const { activeTab, machinesBySegment, cardProps, selectedSegmentIds } = shared;
  return (
    <SegmentGroupContainer groupId="" className="ungrouped-section" color={activeTab?.color}>
      <header>
        <div className="group-header-main">
          <span className="segment-filter-dot group" />
          <div className="group-title-copy">
            <strong>Sem grupo</strong>
            <span>{pluralizeSegments(segments.length)}</span>
          </div>
        </div>
      </header>
      {segments.map((segment, segmentIndex) => (
        <BoardSegmentCard
          key={segment.id}
          segment={segment}
          machinesBySegment={machinesBySegment}
          cardProps={cardProps}
          canMoveSegmentUp={segmentIndex > 0}
          canMoveSegmentDown={segmentIndex < segments.length - 1}
          selected={selectedSegmentIds.has(segment.id)}
        />
      ))}
    </SegmentGroupContainer>
  );
}

// Pilha de segmentos: grupos, "Sem grupo", segmentos avulsos e o estado vazio.
export default function BoardSegmentStack({ sections, shared }) {
  const { groupedSections, ungroupedSegments, standaloneSegments, showUngroupedSection, hasVisibleSections } = sections;
  return (
    <section className="segment-stack" aria-label="Segmentos de inventário">
      {groupedSections.map((group, groupIndex) => (
        <GroupSection key={group.id} group={group} groupIndex={groupIndex} groupCount={groupedSections.length} shared={shared} />
      ))}
      {showUngroupedSection && <UngroupedSection segments={ungroupedSegments} shared={shared} />}
      {standaloneSegments.map((segment) => (
        <BoardSegmentCard
          key={segment.id}
          segment={segment}
          machinesBySegment={shared.machinesBySegment}
          cardProps={shared.cardProps}
          canMoveSegmentUp={false}
          canMoveSegmentDown={false}
          hideGroupSelect
          selected={shared.selectedSegmentIds.has(segment.id)}
        />
      ))}
      {!hasVisibleSections && (
        <section className="segment-card empty-only">
          <Database size={24} />
          <p>Nenhum segmento encontrado.</p>
        </section>
      )}
    </section>
  );
}
