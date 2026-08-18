export const LINK_TYPE_OPTIONS = [
  { value: "ethernet", label: "Ethernet" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "fiber", label: "Fibra" },
  { value: "logical", label: "Lógica" },
  { value: "unknown", label: "Não especificada" }
];

export function linkTypeLabel(value) {
  return LINK_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Não especificada";
}
