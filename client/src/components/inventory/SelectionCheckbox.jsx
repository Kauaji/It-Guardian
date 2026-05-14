import { Check } from "lucide-react";

export default function SelectionCheckbox({ checked, onToggle }) {
  return (
    <button
      type="button"
      className={`selection-checkbox ${checked ? "checked" : ""}`}
      aria-pressed={checked}
      title={checked ? "Remover da selecao" : "Selecionar equipamento"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {checked && <Check size={12} />}
    </button>
  );
}
