const preferredObjectKeys = [
  "label",
  "name",
  "status",
  "value",
  "version",
  "manufacturer",
  "product"
];

function isPresent(value) {
  return value !== null && value !== undefined && value !== "";
}

export function formatHardwareValue(value, fallback = "Não disponível") {
  if (!isPresent(value)) return fallback;

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (Array.isArray(value)) {
    const formattedValues = value
      .map((item) => formatHardwareValue(item, ""))
      .filter(Boolean);
    return formattedValues.length ? formattedValues.join(", ") : fallback;
  }

  if (typeof value === "object") {
    const name = isPresent(value.name) ? String(value.name) : "";
    const version = isPresent(value.version) ? String(value.version) : "";
    if (name || version) return [name, version].filter(Boolean).join(" ");

    for (const key of preferredObjectKeys) {
      if (isPresent(value[key]) && typeof value[key] !== "object") {
        return formatHardwareValue(value[key], fallback);
      }
    }

    const facts = Object.entries(value)
      .filter(([, item]) => isPresent(item) && typeof item !== "object")
      .slice(0, 4)
      .map(([key, item]) => `${key}: ${formatHardwareValue(item, "")}`)
      .filter((item) => !item.endsWith(": "));

    return facts.length ? facts.join(" · ") : fallback;
  }

  return String(value);
}

export function formatSoftwareLabel(software) {
  if (typeof software === "string") return software;
  return formatHardwareValue({
    name: software?.name || software?.title,
    version: software?.version
  }, "Software sem nome");
}

export function softwareIdentity(software, index = 0) {
  if (typeof software === "string") return `${software}-${index}`;
  return [
    software?.name || software?.title || "software",
    software?.version || "",
    software?.manufacturer || software?.publisher || "",
    index
  ].join("-");
}
