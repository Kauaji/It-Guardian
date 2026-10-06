import { isWallObject } from "../utils/wallGeometry.js";
import { buildDoor } from "./doorBuilders.js";
import {
  buildAccessPoint,
  buildCamera,
  buildComputer,
  buildNetworkBox,
  buildPowerAccessory,
  buildPrinter,
  buildRack,
  buildTv
} from "./equipmentBuilders.js";
import { buildCabinet, buildChair, buildGenericBox, buildShelf, buildTable, buildWall, buildWindow } from "./furnitureBuilders.js";

const TABLE_TYPES = ["desk", "table", "meeting_table", "meeting-table"];
const POWER_TYPES = ["outlet", "power_cable", "stabilizer_600", "stabilizer_1000", "extension_cord", "power_strip"];

/** Construtor procedural de cada tipo de objeto, na ordem em que sao avaliados. */
const BUILDERS = [
  [(ctx) => isWallObject(ctx.object), buildWall],
  [(ctx) => TABLE_TYPES.includes(ctx.type), buildTable],
  [(ctx) => ctx.type === "chair", buildChair],
  [(ctx) => ctx.type === "cabinet", buildCabinet],
  [(ctx) => ctx.type === "shelf", buildShelf],
  [(ctx) => ["pc", "notebook"].includes(ctx.type), buildComputer],
  [(ctx) => ctx.type === "printer", buildPrinter],
  [(ctx) => ["rack", "server"].includes(ctx.type), buildRack],
  [(ctx) => ["switch", "firewall", "router"].includes(ctx.type), buildNetworkBox],
  [(ctx) => ctx.type === "access_point", buildAccessPoint],
  [(ctx) => ctx.type === "camera", buildCamera],
  [(ctx) => ctx.type === "tv", buildTv],
  [(ctx) => ctx.type === "door", buildDoor],
  [(ctx) => ctx.type === "window", buildWindow],
  [(ctx) => POWER_TYPES.includes(ctx.type), buildPowerAccessory]
];

/**
 * Preenche o grupo do objeto com a geometria procedural do seu tipo (ou uma
 * caixa generica). E o fallback usado enquanto/sem modelo 3D detalhado.
 */
export function buildProceduralObject(ctx) {
  const entry = BUILDERS.find(([matches]) => matches(ctx));
  (entry ? entry[1] : buildGenericBox)(ctx);
}
