import { ChevronRight, Cpu, ExternalLink } from "lucide-react";
import { formatSegmentName } from "../../../utils/display.js";
import { groupPartsByFamily, summarizeKitFamily } from "../partFamilies.js";

export default function ComputerKitCard({ kit, expanded, focused, cardRef, onToggle, onOpenAsset }) {
  return (
    <article
      ref={cardRef}
      tabIndex={focused ? -1 : undefined}
      className={`computer-kit-card ${expanded ? "is-expanded" : ""} ${focused ? "is-focused" : ""}`}
    >
      <button type="button" className="computer-kit-trigger" onClick={onToggle} aria-expanded={expanded}>
        <span>
          <Cpu size={18} />
        </span>
        <strong>{kit.name}</strong>
        <ChevronRight size={18} />
      </button>
      {expanded ? (
        <div className="computer-kit-details">
          <header>
            <span>
              {formatSegmentName(kit.segmentName)} · {kit.parts.length} componente(s) físico(s)
            </span>
            <button type="button" className="secondary-action" onClick={() => onOpenAsset?.(kit.assetId)}>
              <ExternalLink size={15} /> Abrir ativo
            </button>
          </header>
          {groupPartsByFamily(kit.parts).map((family) => (
            <section key={family.id} style={{ "--family-color": family.color }}>
              <span>{family.label}</span>
              <strong>{summarizeKitFamily(family)}</strong>
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}
