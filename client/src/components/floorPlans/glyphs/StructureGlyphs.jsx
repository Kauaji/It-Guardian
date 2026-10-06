import { getWallOpeningCuts, getWallSolidSegments } from "../utils/wallSegments.js";
import { formatLength, pxToMeters } from "../utils/unitConversion.js";

const selectedClass = (selected) => (selected ? "selected" : "");

export function MeasurementGlyph({ width, height, plan, selected }) {
  const midY = height / 2;
  const tickHalf = Math.max(6, height);
  const label = formatLength(pxToMeters(width, plan));
  return (
    <g className={`floor-plan-object-glyph measurement ${selectedClass(selected)}`}>
      <line className="floor-plan-measurement-line" x1={0} y1={midY} x2={width} y2={midY} />
      <line className="floor-plan-measurement-tick" x1={0} y1={midY - tickHalf} x2={0} y2={midY + tickHalf} />
      <line className="floor-plan-measurement-tick" x1={width} y1={midY - tickHalf} x2={width} y2={midY + tickHalf} />
      <g className="floor-plan-measurement-label" transform={`translate(${width / 2}, ${midY - tickHalf - 6})`}>
        <rect x={-(label.length * 3.6 + 8)} y={-13} width={label.length * 7.2 + 16} height={18} rx={5} />
        <text textAnchor="middle" y={1}>
          {label}
        </text>
      </g>
    </g>
  );
}

export function WallGlyph({ width, height, color, openings, selected }) {
  const cuts = getWallOpeningCuts(width, openings);
  const segments = getWallSolidSegments(width, cuts);
  return (
    <g className={`floor-plan-object-glyph wall ${selectedClass(selected)}`}>
      {segments.map((segment, index) => (
        <rect
          key={`${segment.start}-${segment.end}-${index}`}
          x={segment.start}
          width={Math.max(0, segment.end - segment.start)}
          height={height}
          rx="2"
          fill={color}
          stroke={color}
        />
      ))}
    </g>
  );
}

function DoubleDoor({ width, height, metadata, color, selected }) {
  const outward = metadata?.swing === "outward";
  const hingeY = outward ? 2 : height - 2;
  const center = width / 2;
  const openY = outward ? height - 3 : 3;
  const leftEndX = Math.max(8, center - 2);
  const rightEndX = Math.min(width - 8, center + 2);
  return (
    <g
      className={`floor-plan-object-glyph opening door double ${selectedClass(selected)}`}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    >
      <line x1="0" y1={hingeY} x2="7" y2={hingeY} strokeWidth="4" />
      <line x1={width - 7} y1={hingeY} x2={width} y2={hingeY} strokeWidth="4" />
      <line x1="7" y1={hingeY} x2={leftEndX} y2={openY} />
      <line x1={width - 7} y1={hingeY} x2={rightEndX} y2={openY} />
      <path d={`M ${leftEndX} ${openY} Q ${center - 2} ${hingeY} ${center} ${hingeY}`} strokeDasharray="3 2" opacity="0.72" />
      <path d={`M ${rightEndX} ${openY} Q ${center + 2} ${hingeY} ${center} ${hingeY}`} strokeDasharray="3 2" opacity="0.72" />
      <circle cx="7" cy={hingeY} r="1.6" />
      <circle cx={width - 7} cy={hingeY} r="1.6" />
    </g>
  );
}

function SlidingDoor({ width, height, metadata, color, selected }) {
  const reverseSlide = metadata?.slideDirection === "left";
  const panelWidth = width * 0.56;
  const firstX = reverseSlide ? width - panelWidth - 2 : 2;
  const secondX = reverseSlide ? 2 : width - panelWidth - 2;
  return (
    <g className={`floor-plan-object-glyph opening door sliding ${selectedClass(selected)}`} stroke={color} strokeWidth="2" fill="none">
      <line x1="0" y1={height * 0.2} x2={width} y2={height * 0.2} strokeWidth="4" />
      <rect x={firstX} y={height * 0.32} width={panelWidth} height={height * 0.44} rx="1" />
      <rect x={secondX} y={height * 0.44} width={panelWidth} height={height * 0.32} rx="1" />
      <line x1={firstX + panelWidth * 0.75} y1={height * 0.38} x2={firstX + panelWidth * 0.75} y2={height * 0.7} />
    </g>
  );
}

function PocketDoor({ width, height, metadata, color, selected }) {
  const reverseSlide = metadata?.slideDirection === "left";
  const pocketStart = reverseSlide ? 2 : width * 0.52;
  const panelStart = reverseSlide ? width * 0.42 : 2;
  return (
    <g className={`floor-plan-object-glyph opening door pocket ${selectedClass(selected)}`} stroke={color} strokeWidth="2" fill="none">
      <line x1="0" y1={height * 0.24} x2={width} y2={height * 0.24} strokeWidth="4" />
      <line x1="0" y1={height * 0.78} x2={width} y2={height * 0.78} strokeWidth="4" />
      <rect x={pocketStart} y={height * 0.15} width={width * 0.46} height={height * 0.72} rx="1" className="pocket-casing" />
      <rect x={panelStart} y={height * 0.32} width={width * 0.5} height={height * 0.42} rx="1" />
      <circle cx={panelStart + width * 0.42} cy={height * 0.53} r="1.4" />
    </g>
  );
}

function SingleDoor({ width, height, metadata, color, selected }) {
  const outward = metadata?.swing === "outward";
  const hingeY = outward ? 2 : height - 2;
  const openY = outward ? height - 3 : 3;
  const hingeX = 7;
  const jambX = width - 7;
  return (
    <g
      className={`floor-plan-object-glyph opening door single ${selectedClass(selected)}`}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    >
      <line x1="0" y1={hingeY} x2={hingeX} y2={hingeY} strokeWidth="4" />
      <line x1={jambX} y1={hingeY} x2={width} y2={hingeY} strokeWidth="4" />
      <line x1={hingeX} y1={hingeY} x2={hingeX} y2={openY} />
      <path d={`M ${hingeX} ${openY} Q ${jambX} ${openY} ${jambX} ${hingeY}`} strokeDasharray="3 2" opacity="0.72" />
      <circle cx={hingeX} cy={hingeY} r="1.6" />
    </g>
  );
}

const DOOR_GLYPHS = { double: DoubleDoor, sliding: SlidingDoor, pocket: PocketDoor };

/** Porta: simples (padrao), dupla, de correr ou embutida. */
export function DoorGlyph(props) {
  const Glyph = DOOR_GLYPHS[props.metadata?.doorType || "single"] || SingleDoor;
  return <Glyph {...props} />;
}

export function WindowGlyph({ width, height, color, selected }) {
  return (
    <g className={`floor-plan-object-glyph opening window ${selectedClass(selected)}`} stroke={color}>
      <line x1="2" y1={height * 0.34} x2={width - 2} y2={height * 0.34} />
      <line x1="2" y1={height * 0.66} x2={width - 2} y2={height * 0.66} />
      <line x1={width / 2} y1="1" x2={width / 2} y2={height - 1} />
    </g>
  );
}
