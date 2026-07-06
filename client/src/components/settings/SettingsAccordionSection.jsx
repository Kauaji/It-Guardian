import { ChevronRight } from "lucide-react";

export default function SettingsAccordionSection({ id, title, description, activeSection, onToggle, children }) {
  const open = activeSection === id;
  return (
    <section className={`service-order-settings-accordion ${open ? "open" : ""}`}>
      <button
        type="button"
        className="service-order-settings-accordion-trigger"
        onClick={() => onToggle(open ? "" : id)}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronRight size={18} />
      </button>
      {open && <div className="service-order-settings-accordion-body">{children}</div>}
    </section>
  );
}
