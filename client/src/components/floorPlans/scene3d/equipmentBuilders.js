/**
 * Construtores procedurais de equipamentos de TI, energia e audiovisual.
 * Mesmo contexto dos construtores de mobiliario.
 */

const NEUTRAL = "#f8fafc";
const ACCENT = "#0f172a";

function addComputer(ctx) {
  const { group, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, { x: -objectWidth * 0.15, width: objectWidth * 0.5, depth: 7, height: 32, y: 8, color: "#2563eb", emissive: "#0f5fff", emissiveIntensity: 0.34 });
  parts.addModelPart(group, { x: -objectWidth * 0.15, z: -2, width: objectWidth * 0.62, depth: 4, height: 40, y: 6, color: "#111827", opacity: 0.92 });
  parts.addModelPart(group, { x: objectWidth * 0.28, width: 13, depth: objectDepth * 0.42, height: 42, y: 0, color: "#1f2937", metalness: 0.18 });
  parts.addModelPart(group, { x: -objectWidth * 0.15, z: objectDepth * 0.18, width: objectWidth * 0.35, depth: 12, height: 5, y: 0, color: "#475569" });
}

function addLaptop(ctx) {
  const { group, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.52, height: 5, y: 0, color: "#334155" });
  parts.addModelPart(group, { z: -objectDepth * 0.18, width: objectWidth * 0.7, depth: 5, height: 30, y: 3, color: "#1d4ed8", emissive: "#0f5fff", emissiveIntensity: 0.28 });
}

/** PC (torre, monitor e teclado) ou notebook. */
export function buildComputer(ctx) {
  if (ctx.type === "pc") addComputer(ctx);
  else addLaptop(ctx);
}

export function buildPrinter(ctx) {
  const { group, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.74, height: 24, y: 0, color: NEUTRAL, metalness: 0.1 });
  parts.addModelPart(group, { z: -objectDepth * 0.34, width: objectWidth * 0.72, depth: 8, height: 5, y: 22, color: "#cbd5e1" });
}

function addSwitchPorts(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, {
    z: -objectDepth * 0.39,
    y: 56,
    width: objectWidth * 0.58,
    depth: 4,
    height: 10,
    color: "#2563eb",
    metalness: 0.26
  });
  const totalPorts = Math.max(1, Math.min(48, Number(object.metadata?.switchTotalPorts || 24)));
  const workingPorts = Math.max(0, Math.min(totalPorts, Number(object.metadata?.switchWorkingPorts ?? totalPorts)));
  const visiblePorts = Math.min(12, totalPorts);
  for (let index = 0; index < visiblePorts; index += 1) {
    const working = index < Math.ceil((workingPorts / totalPorts) * visiblePorts);
    parts.addModelPart(group, {
      x: -objectWidth * 0.23 + index * ((objectWidth * 0.46) / Math.max(visiblePorts - 1, 1)),
      z: -objectDepth * 0.43,
      y: 59,
      width: 2.4,
      depth: 2,
      height: 2.4,
      color: working ? "#22c55e" : "#ef4444",
      metalness: 0.12,
      emissive: working ? "#16a34a" : "#dc2626",
      emissiveIntensity: 0.72
    });
  }
}

/** Rack ou servidor; racks com switch instalado mostram as portas (verdes = funcionando). */
export function buildRack(ctx) {
  const { group, object, type, width: objectWidth, depth: objectDepth, color, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 90, y: 0, color: "#111827", metalness: 0.22 });
  for (let index = 0; index < 5; index += 1) {
    parts.addModelPart(group, { z: -objectDepth * 0.38, y: 12 + index * 14, width: objectWidth * 0.56, depth: 3, height: 5, color });
  }
  if (type === "rack" && object.metadata?.switchInstalled) addSwitchPorts(ctx);
}

export function buildNetworkBox(ctx) {
  const { group, width: objectWidth, depth: objectDepth, color, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.64, height: 14, y: 18, color: "#334155", metalness: 0.18 });
  parts.addModelPart(group, { z: -objectDepth * 0.32, width: objectWidth * 0.7, depth: 3, height: 4, y: 28, color, emissive: color, emissiveIntensity: 0.38 });
}

export function buildAccessPoint(ctx) {
  const { group, width: objectWidth, depth: objectDepth, color, parts } = ctx;
  parts.addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.28, height: 9, y: 22, color: NEUTRAL });
  parts.addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.11, height: 11, y: 28, color });
}

export function buildCamera(ctx) {
  const { group, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.62, depth: objectDepth * 0.42, height: 18, y: 28, color: NEUTRAL, metalness: 0.12 });
  const lens = parts.addCylinderPart(group, { z: -objectDepth * 0.25, radius: Math.min(objectWidth, objectDepth) * 0.12, height: 10, y: 31, color: ACCENT });
  lens.rotation.x = Math.PI / 2;
  parts.addModelPart(group, { z: objectDepth * 0.22, width: 8, depth: 16, height: 28, y: 4, color: "#64748b", metalness: 0.18 });
}

export function buildTv(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  const screenHeight = Number(object.height3d || 52);
  parts.addModelPart(group, {
    width: objectWidth * 0.9,
    depth: Math.max(5, objectDepth * 0.2),
    height: screenHeight * 0.72,
    y: screenHeight * 0.2,
    color: ACCENT,
    metalness: 0.22
  });
  parts.addModelPart(group, {
    z: -Math.max(3, objectDepth * 0.11),
    width: objectWidth * 0.8,
    depth: 2,
    height: screenHeight * 0.58,
    y: screenHeight * 0.27,
    color: "#2563eb",
    opacity: 0.92,
    emissive: "#0f5fff",
    emissiveIntensity: 0.42
  });
  parts.addModelPart(group, { width: 5, depth: 5, height: screenHeight * 0.18, y: 2, color: "#334155", metalness: 0.45 });
  parts.addModelPart(group, { width: objectWidth * 0.34, depth: objectDepth * 0.36, height: 4, y: 0, color: "#334155", metalness: 0.45 });
}

/** Tomada, estabilizador, extensao e regua de tomadas. */
export function buildPowerAccessory(ctx) {
  const { group, type, width: objectWidth, depth: objectDepth, parts } = ctx;
  const isStrip = ["power_strip", "extension_cord", "power_cable"].includes(type);
  parts.addModelPart(group, { width: isStrip ? objectWidth * 0.9 : objectWidth * 0.58, depth: isStrip ? 11 : objectDepth * 0.5, height: isStrip ? 8 : 22, y: 12, color: "#f59e0b" });
  parts.addModelPart(group, { x: objectWidth * 0.18, width: 5, depth: 5, height: 5, y: 21, color: ACCENT });
}
