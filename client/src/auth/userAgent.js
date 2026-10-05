const browsers = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"]
];
const systems = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iOS/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"]
];

/** Rotulo curto do dispositivo ("Chrome em Windows") a partir do User-Agent bruto. */
export function describeDevice(userAgent) {
  const raw = String(userAgent || "");
  if (!raw) return "Dispositivo desconhecido";
  const browser = browsers.find(([pattern]) => pattern.test(raw))?.[1];
  const system = systems.find(([pattern]) => pattern.test(raw))?.[1];
  if (browser && system) return `${browser} em ${system}`;
  return browser || system || "Dispositivo desconhecido";
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
