import { ChevronDown } from "lucide-react";

// Secao recolhivel do modal de configuracoes de aviso.
export default function SettingsAccordion({ title, description, open, onToggle, children }) {
  return (
    <section className={`alert-settings-accordion ${open ? "open" : ""}`}>
      <button type="button" className="alert-settings-accordion-trigger" onClick={onToggle}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <ChevronDown size={18} />
      </button>
      {open && children}
    </section>
  );
}
