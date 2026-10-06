import { FolderTree, Layers3 } from "lucide-react";
import { formatSegmentName } from "../../../utils/display.js";
import { buildKitHierarchy } from "../partFamilies.js";
import ComputerKitCard from "./ComputerKitCard.jsx";

function KitTabs({ tabs, activeTabId, onSelectTab }) {
  return (
    <nav className="computer-kits-tabs" aria-label="Ambientes dos kits">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={tab.id === activeTabId ? "active" : ""}
          style={{ "--tab-color": tab.color || "#2563eb" }}
          onClick={() => onSelectTab(tab.id)}
        >
          <span />
          {tab.name || "Novo ambiente"}
        </button>
      ))}
    </nav>
  );
}

export default function ComputerKitsView({
  kits,
  tabs,
  groups,
  segments,
  activeTabId,
  onSelectTab,
  expandedKitId,
  focusedKitAssetId,
  focusedKitRef,
  onToggleKit,
  onOpenAsset
}) {
  const hierarchy = buildKitHierarchy(kits, { tabs, groups, segments, activeTabId });
  const renderKit = (kit) => (
    <ComputerKitCard
      key={kit.assetId}
      kit={kit}
      expanded={expandedKitId === kit.assetId}
      focused={focusedKitAssetId === kit.assetId}
      cardRef={focusedKitAssetId === kit.assetId ? focusedKitRef : null}
      onToggle={() => onToggleKit(kit.assetId)}
      onOpenAsset={onOpenAsset}
    />
  );
  const renderSegment = (segment) => (
    <section className="computer-kits-segment" style={{ "--segment-color": segment.color || "#2563eb" }} key={segment.id}>
      <header>
        <span />
        <div>
          <strong>{formatSegmentName(segment.name)}</strong>
          <small>
            {segment.kits.length} {segment.kits.length === 1 ? "máquina" : "máquinas"}
          </small>
        </div>
      </header>
      <div className="computer-kits-grid">{segment.kits.map(renderKit)}</div>
    </section>
  );

  return (
    <div className="computer-kits-hierarchy">
      {tabs.length ? <KitTabs tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} /> : null}
      {hierarchy.groups.map((group) => (
        <section className="computer-kits-group" style={{ "--group-color": group.color || "#64748b" }} key={group.id}>
          <header>
            <FolderTree size={17} />
            <strong>{group.name}</strong>
            <small>{group.segments.reduce((total, segment) => total + segment.kits.length, 0)} máquina(s)</small>
          </header>
          {group.segments.map(renderSegment)}
        </section>
      ))}
      {hierarchy.standaloneSegments.map(renderSegment)}
      {!hierarchy.groups.length && !hierarchy.standaloneSegments.length ? (
        <div className="parts-empty">
          <Layers3 size={34} />
          <strong>Nenhum kit neste ambiente</strong>
          <span>Os kits acompanham a mesma organização do Inventário de Ativos.</span>
        </div>
      ) : null}
    </div>
  );
}
