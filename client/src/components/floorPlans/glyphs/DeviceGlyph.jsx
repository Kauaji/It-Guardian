import {
  accessPointGlyph,
  audioGlyph,
  cabinetGlyph,
  cameraGlyph,
  computerGlyph,
  laptopGlyph,
  networkBoxGlyph,
  powerGlyph,
  printerGlyph,
  tvGlyph
} from "./equipmentGlyphs.jsx";
import {
  armchairGlyph,
  bedGlyph,
  chairGlyph,
  counterGlyph,
  deskCornerGlyph,
  fallbackGlyph,
  kitchenGlyph,
  officeChairGlyph,
  roundTableGlyph,
  smallFurnitureGlyph,
  stairsGlyph,
  tableGlyph
} from "./furnitureGlyphs.jsx";

const oneOf = (names) => (type) => names.includes(type);
const includesAny = (names) => (type) => names.some((name) => type.includes(name));

/** Glifo por tipo, na ordem em que os tipos sao avaliados (o primeiro que combina vence). */
const GLYPHS = [
  [oneOf(["desk_corner"]), deskCornerGlyph],
  [oneOf(["round_table", "coffee_table"]), roundTableGlyph],
  [oneOf(["desk", "table", "meeting-table", "meeting_table"]), tableGlyph],
  [oneOf(["chair", "visitor_chair", "waiting_chair"]), chairGlyph],
  [oneOf(["office_chair"]), officeChairGlyph],
  [oneOf(["armchair"]), armchairGlyph],
  [oneOf(["pc", "desktop", "computer", "workstation"]), computerGlyph],
  [oneOf(["notebook", "laptop"]), laptopGlyph],
  [oneOf(["printer"]), printerGlyph],
  [includesAny(["cabinet", "shelf", "bookcase", "rack", "server", "rack-12u", "rack_12u"]), cabinetGlyph],
  [oneOf(["side_table", "coat_rack", "potted_plant", "floor_lamp"]), smallFurnitureGlyph],
  [oneOf(["switch", "router", "firewall"]), networkBoxGlyph],
  [oneOf(["access-point", "access_point", "ap"]), accessPointGlyph],
  [oneOf(["tv"]), tvGlyph],
  [oneOf(["speaker", "radio"]), audioGlyph],
  [includesAny(["camera"]), cameraGlyph],
  [includesAny(["stabilizer", "stabilizer-600", "stabilizer-1000", "power-strip", "extension"]), powerGlyph],
  [oneOf(["hospital_bed", "stretcher", "single_bed", "double_bed"]), bedGlyph],
  [oneOf(["medical_cart", "reception_counter", "counter", "sofa", "waiting_bench"]), counterGlyph],
  [oneOf(["fridge", "microwave"]), kitchenGlyph],
  [oneOf(["stairs"]), stairsGlyph]
];

/** Desenho (sem o grupo externo) de um equipamento ou movel; caixa generica se o tipo e desconhecido. */
export default function DeviceGlyph({ type, width, height, metadata = {} }) {
  const normalized = String(type || "").toLowerCase();
  const context = {
    type: normalized,
    width,
    height,
    metadata,
    cx: width / 2,
    cy: height / 2,
    inset: Math.max(4, Math.min(width, height) * 0.12)
  };
  const entry = GLYPHS.find(([matches]) => matches(normalized));
  return (entry ? entry[1] : fallbackGlyph)(context);
}
