import { Search } from "lucide-react";

export default function OrderSearchField({ value, onChange }) {
  return (
    <label className={`service-order-search ${value ? "has-value" : ""}`}>
      <Search size={16} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Pesquisar OS ou técnico"
        aria-label="Pesquisar por ordem de serviço ou técnico"
      />
    </label>
  );
}
