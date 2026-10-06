import { familyIcon } from "../utils/partIcons.js";
import PartCard from "./PartCard.jsx";

export default function PartsFamilyList({ families, onOpenPart }) {
  return (
    <div className="parts-family-list">
      {families.map((family) => {
        const Icon = familyIcon(family.id);
        return (
          <section className="parts-family-section" style={{ "--family-color": family.color }} key={family.id}>
            <header>
              <span>
                <Icon size={18} />
              </span>
              <div>
                <h3>{family.label}</h3>
                <small>{family.parts.length} cadastro(s) nesta família</small>
              </div>
            </header>
            <div className="parts-grid">
              {family.parts.map((part) => (
                <PartCard part={part} onOpen={onOpenPart} key={part.id} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
