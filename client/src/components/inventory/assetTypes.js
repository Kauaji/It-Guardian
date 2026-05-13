export const assetTypeOptions = [
  { value: "server", label: "Servidor" },
  { value: "desktop", label: "Desktop" },
  { value: "notebook", label: "Notebook" },
  { value: "printer", label: "Impressora" },
  { value: "router", label: "Roteador" },
  { value: "switch", label: "Switch" },
  { value: "access_point", label: "Access Point" },
  { value: "camera_ip", label: "Camera IP" },
  { value: "nas", label: "NAS" },
  { value: "other", label: "Outro" }
];

export function assetTypeLabel(value) {
  return assetTypeOptions.find((option) => option.value === value)?.label || "Outro";
}
