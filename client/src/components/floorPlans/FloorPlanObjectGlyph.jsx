import DeviceGlyph from "./glyphs/DeviceGlyph.jsx";
import { DoorGlyph, MeasurementGlyph, WallGlyph, WindowGlyph } from "./glyphs/StructureGlyphs.jsx";
import { isMeasurementObject } from "./utils/measurementGeometry.js";
import { resolveSceneObjectType } from "./utils/sceneObjectPlacement.js";
import { isOpeningObject, isWallObject } from "./utils/wallGeometry.js";

const FALLBACK_COLORS = {
  pc: "#2563eb",
  desktop: "#2563eb",
  computer: "#2563eb",
  workstation: "#2563eb",
  notebook: "#2563eb",
  laptop: "#2563eb",
  printer: "#475569",
  tv: "#1e293b"
};
const INVISIBLE_COLORS = ["#fff", "#ffffff", "white", "rgb(255, 255, 255)"];

/** Cor do tracado: a do objeto, ou uma cor por tipo quando ausente/branca (invisivel no papel). */
function resolveGlyphColor(object, type) {
  const rawColor = String(object?.color || "").trim();
  const isInvisibleColor = INVISIBLE_COLORS.includes(rawColor.toLowerCase());
  return !rawColor || isInvisibleColor ? (FALLBACK_COLORS[type] || "#475569") : rawColor;
}

/** Glifo 2D (SVG) de um objeto da planta: medida, parede, porta, janela ou equipamento/movel. */
export default function FloorPlanObjectGlyph({ object, width, height, selected = false, openings = [], plan = {} }) {
  if (isMeasurementObject(object)) {
    return <MeasurementGlyph width={width} height={height} plan={plan} selected={selected} />;
  }

  const type = resolveSceneObjectType(object);
  const color = resolveGlyphColor(object, type);

  if (isWallObject(object)) return <WallGlyph width={width} height={height} color={color} openings={openings} selected={selected} />;
  if (type === "door") return <DoorGlyph width={width} height={height} metadata={object?.metadata} color={color} selected={selected} />;
  if (type === "window") return <WindowGlyph width={width} height={height} color={color} selected={selected} />;

  return (
    <g className={`floor-plan-object-glyph ${isOpeningObject(object) ? "opening" : "fixture"} ${selected ? "selected" : ""}`} stroke={color} fill="none">
      <DeviceGlyph type={type} width={width} height={height} metadata={object?.metadata || {}} />
    </g>
  );
}
