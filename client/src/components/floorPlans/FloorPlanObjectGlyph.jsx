import { isOpeningObject, isWallObject } from "./utils/wallGeometry.js";
import { isMeasurementObject } from "./utils/measurementGeometry.js";
import { formatLength, pxToMeters } from "./utils/unitConversion.js";
import { resolveSceneObjectType } from "./utils/sceneObjectPlacement.js";

function Rect({ x = 0, y = 0, width, height, rx = 2, className = "" }) {
  return <rect className={className} x={x} y={y} width={width} height={height} rx={rx} />;
}

function DeviceGlyph({ type, width, height, metadata = {} }) {
  const cx = width / 2;
  const cy = height / 2;
  const inset = Math.max(4, Math.min(width, height) * 0.12);
  const normalized = String(type || "").toLowerCase();

  if (normalized === "desk_corner") {
    const thickness = Math.max(12, Math.min(width, height) * 0.34);
    return (
      <>
        <path d={`M ${inset} ${inset} H ${width - inset} V ${inset + thickness} H ${inset + thickness} V ${height - inset} H ${inset} Z`} />
        <line x1={inset + 7} y1={inset + 5} x2={width - inset - 7} y2={inset + 5} />
        <line x1={inset + 5} y1={inset + 7} x2={inset + 5} y2={height - inset - 7} />
      </>
    );
  }

  if (["round_table", "coffee_table"].includes(normalized)) {
    const rx = normalized === "round_table" ? Math.min(width, height) * 0.38 : width * 0.38;
    const ry = normalized === "round_table" ? Math.min(width, height) * 0.38 : height * 0.3;
    return (
      <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        <ellipse cx={cx} cy={cy} rx={Math.max(4, rx - 6)} ry={Math.max(4, ry - 6)} opacity="0.45" />
        <circle cx={cx} cy={cy} r="2.5" />
      </>
    );
  }

  if (["desk", "table", "meeting-table", "meeting_table"].includes(normalized)) {
    const meeting = normalized.includes("meeting");
    return (
      <>
        <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={meeting ? 12 : 4} />
        <line x1={inset + 6} y1={inset + 5} x2={inset + 6} y2={height - inset - 5} />
        <line x1={width - inset - 6} y1={inset + 5} x2={width - inset - 6} y2={height - inset - 5} />
        {meeting ? <line x1={cx} y1={inset + 5} x2={cx} y2={height - inset - 5} /> : null}
      </>
    );
  }

  if (["chair", "visitor_chair", "waiting_chair"].includes(normalized)) {
    const seat = Math.min(width, height) * 0.48;
    return (
      <>
        <Rect x={cx - seat / 2} y={cy - seat / 2 + 3} width={seat} height={seat} rx={4} />
        <path d={`M ${cx - seat / 2 - 3} ${cy - seat / 2 + 1} Q ${cx} ${cy - seat / 2 - 7} ${cx + seat / 2 + 3} ${cy - seat / 2 + 1}`} />
        <line x1={cx - seat / 2 - 4} y1={cy - seat / 2 + 5} x2={cx - seat / 2 - 4} y2={cy + seat / 2} />
        <line x1={cx + seat / 2 + 4} y1={cy - seat / 2 + 5} x2={cx + seat / 2 + 4} y2={cy + seat / 2} />
      </>
    );
  }

  if (normalized === "office_chair") {
    const seat = Math.min(width, height) * 0.42;
    return (
      <>
        <Rect x={cx - seat / 2} y={cy - seat / 2} width={seat} height={seat} rx={5} />
        <path d={`M ${cx - seat / 2} ${cy - seat / 2} Q ${cx} ${cy - seat / 2 - 8} ${cx + seat / 2} ${cy - seat / 2}`} />
        {[0, 72, 144, 216, 288].map((angle) => {
          const radians = (angle * Math.PI) / 180;
          return <line key={angle} x1={cx} y1={cy} x2={cx + Math.cos(radians) * seat * 0.9} y2={cy + Math.sin(radians) * seat * 0.9} />;
        })}
        <circle cx={cx} cy={cy} r="3" />
      </>
    );
  }

  if (normalized === "armchair") {
    return (
      <>
        <Rect x={inset} y={inset + 4} width={width - inset * 2} height={height - inset * 2 - 4} rx={10} />
        <Rect x={inset + 8} y={inset + 10} width={width - inset * 2 - 16} height={height - inset * 2 - 18} rx={7} />
        <line x1={inset + 6} y1={inset + 6} x2={width - inset - 6} y2={inset + 6} />
      </>
    );
  }

  if (["pc", "desktop", "computer", "workstation"].includes(normalized)) {
    return (
      <>
        <Rect x={inset} y={inset} width={width * 0.56} height={height * 0.5} rx={3} />
        <line x1={inset + width * 0.28} y1={inset + height * 0.5} x2={inset + width * 0.28} y2={height * 0.74} />
        <line x1={inset + width * 0.12} y1={height * 0.74} x2={inset + width * 0.44} y2={height * 0.74} />
        <Rect x={width * 0.73} y={inset} width={Math.max(8, width * 0.16)} height={height * 0.66} rx={2} />
        <circle cx={width * 0.81} cy={height * 0.57} r="1.8" />
        <Rect x={inset + 2} y={height * 0.81} width={width * 0.56} height={Math.max(4, height * 0.1)} rx={2} />
      </>
    );
  }

  if (["notebook", "laptop"].includes(normalized)) {
    return (
      <>
        <Rect x={inset} y={inset} width={width - inset * 2} height={height * 0.54} rx={3} />
        <path d={`M ${inset - 3} ${height * 0.72} L ${width - inset + 3} ${height * 0.72} L ${width - inset - 2} ${height - inset} L ${inset + 2} ${height - inset} Z`} />
        <line x1={cx - 5} y1={height * 0.82} x2={cx + 5} y2={height * 0.82} />
      </>
    );
  }

  if (normalized === "printer") {
    return (
      <>
        <Rect x={inset + 4} y={inset} width={width - inset * 2 - 8} height={height * 0.34} rx={2} />
        <Rect x={inset} y={height * 0.34} width={width - inset * 2} height={height * 0.46} rx={5} />
        <Rect x={inset + 7} y={height * 0.62} width={width - inset * 2 - 14} height={height * 0.25} rx={1} />
        <circle cx={width - inset - 7} cy={height * 0.47} r="2" />
      </>
    );
  }

  if (["cabinet", "shelf", "bookcase", "rack", "server", "rack-12u", "rack_12u"].some((name) => normalized.includes(name))) {
    const rackWithSwitch = normalized.includes("rack") && metadata.switchInstalled;
    const totalPorts = Math.max(1, Number(metadata.switchTotalPorts || 24));
    const workingPorts = Math.max(0, Math.min(totalPorts, Number(metadata.switchWorkingPorts ?? totalPorts)));
    const visiblePorts = Math.min(totalPorts, 12);
    return (
      <>
        <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={3} />
        {[0.3, 0.48, 0.66].map((ratio) => <line key={ratio} x1={inset + 5} y1={height * ratio} x2={width - inset - 5} y2={height * ratio} />)}
        <circle cx={width - inset - 7} cy={height * 0.22} r="2" />
        {rackWithSwitch ? (
          <g className="floor-plan-rack-switch">
            <Rect x={inset + 5} y={height * 0.36} width={width - inset * 2 - 10} height={Math.max(12, height * 0.18)} rx={2} />
            {Array.from({ length: visiblePorts }, (_, index) => {
              const portX = inset + 9 + (index * (width - inset * 2 - 18)) / Math.max(visiblePorts - 1, 1);
              return <circle key={index} cx={portX} cy={height * 0.45} r="1.4" className={index < workingPorts ? "working" : "offline"} />;
            })}
          </g>
        ) : null}
      </>
    );
  }

  if (["side_table", "coat_rack", "potted_plant", "floor_lamp"].includes(normalized)) {
    if (normalized === "potted_plant") {
      return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.24} /><path d={`M ${cx} ${cy} C ${cx - 18} ${cy - 18}, ${cx - 22} ${cy + 8}, ${cx} ${cy + 2} C ${cx + 18} ${cy + 18}, ${cx + 22} ${cy - 8}, ${cx} ${cy - 2}`} /><circle cx={cx} cy={cy} r="3" /></>;
    }
    if (normalized === "coat_rack") {
      return <><circle cx={cx} cy={cy} r="5" /><line x1={cx} y1={inset} x2={cx} y2={height - inset} /><line x1={cx} y1={cy} x2={inset} y2={height - inset} /><line x1={cx} y1={cy} x2={width - inset} y2={height - inset} /><path d={`M ${cx} ${inset + 3} L ${cx - 10} ${inset + 13} M ${cx} ${inset + 3} L ${cx + 10} ${inset + 13}`} /></>;
    }
    if (normalized === "floor_lamp") {
      return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.32} /><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.16} /><line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} /></>;
    }
    return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={3} /><line x1={inset + 4} y1={cy} x2={width - inset - 4} y2={cy} /><circle cx={width - inset - 7} cy={cy - 5} r="1.7" /></>;
  }

  if (["switch", "router", "firewall"].includes(normalized)) {
    return (
      <>
        <Rect x={inset} y={height * 0.28} width={width - inset * 2} height={height * 0.44} rx={4} />
        {[0.26, 0.38, 0.5, 0.62].map((ratio) => <circle key={ratio} cx={width * ratio} cy={cy} r="1.8" />)}
        {normalized === "router" ? <><line x1={inset + 4} y1={height * 0.28} x2={inset} y2={inset} /><line x1={width - inset - 4} y1={height * 0.28} x2={width - inset} y2={inset} /></> : null}
      </>
    );
  }

  if (["access-point", "access_point", "ap"].includes(normalized)) {
    return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.3} /><circle cx={cx} cy={cy} r="3" /><path d={`M ${cx - 12} ${cy - 1} Q ${cx} ${cy - 14} ${cx + 12} ${cy - 1}`} /></>;
  }

  if (normalized === "tv") {
    const screenInsetX = Math.max(3, width * 0.08);
    const screenDepth = Math.max(8, Math.min(height * 0.46, 18));
    const screenY = Math.max(3, (height - screenDepth) / 2 - 2);
    return (
      <>
        <Rect
          x={screenInsetX}
          y={screenY}
          width={width - screenInsetX * 2}
          height={screenDepth}
          rx={2}
          className="floor-plan-tv-bezel"
        />
        <Rect
          x={screenInsetX + 3}
          y={screenY + 3}
          width={Math.max(4, width - screenInsetX * 2 - 6)}
          height={Math.max(3, screenDepth - 6)}
          rx={1}
          className="floor-plan-tv-screen"
        />
        <line x1={cx} y1={screenY + screenDepth} x2={cx} y2={Math.min(height - 3, screenY + screenDepth + 5)} />
        <path
          d={`M ${width * 0.34} ${height - 3} L ${cx} ${Math.min(height - 5, screenY + screenDepth + 3)} L ${width * 0.66} ${height - 3}`}
          className="floor-plan-tv-stand"
        />
      </>
    );
  }

  if (["speaker", "radio"].includes(normalized)) {
    return (
      <>
        <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={3} />
        {normalized === "speaker" ? (
          <><circle cx={cx} cy={cy - 6} r={Math.min(width, height) * 0.12} /><circle cx={cx} cy={cy + 7} r={Math.min(width, height) * 0.2} /></>
        ) : (
          <><line x1={inset + 6} y1={cy - 4} x2={width - inset - 6} y2={cy - 4} /><circle cx={width - inset - 10} cy={cy + 7} r="4" /><line x1={inset + 6} y1={cy + 7} x2={cx} y2={cy + 7} /></>
        )}
      </>
    );
  }

  if (normalized.includes("camera")) {
    return <><path d={`M ${inset} ${cy - 8} H ${width * 0.7} L ${width - inset} ${cy} L ${width * 0.7} ${cy + 8} H ${inset} Z`} /><circle cx={width * 0.68} cy={cy} r="4" /></>;
  }

  if (["stabilizer", "stabilizer-600", "stabilizer-1000", "power-strip", "extension"].some((name) => normalized.includes(name))) {
    return <><Rect x={inset} y={height * 0.28} width={width - inset * 2} height={height * 0.44} rx={5} />{[0.3, 0.5, 0.7].map((ratio) => <circle key={ratio} cx={width * ratio} cy={cy} r="3" />)}<path d={`M ${width - inset} ${cy} Q ${width + 7} ${cy} ${width - 2} ${height - 3}`} /></>;
  }

  if (["hospital_bed", "stretcher", "single_bed", "double_bed"].includes(normalized)) {
    return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={6} /><Rect x={inset + 5} y={inset + 5} width={width - inset * 2 - 10} height={Math.max(12, height * 0.22)} rx={5} /><line x1={inset - 2} y1={height * 0.25} x2={inset - 2} y2={height * 0.75} /><line x1={width - inset + 2} y1={height * 0.25} x2={width - inset + 2} y2={height * 0.75} />{normalized === "stretcher" ? <><circle cx={inset + 3} cy={height - 3} r="3" /><circle cx={width - inset - 3} cy={height - 3} r="3" /></> : null}</>;
  }

  if (["medical_cart", "reception_counter", "counter", "sofa", "waiting_bench"].includes(normalized)) {
    const cushioned = ["sofa", "waiting_bench"].includes(normalized);
    return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={cushioned ? 10 : 3} /><line x1={inset + 5} y1={cy} x2={width - inset - 5} y2={cy} />{cushioned ? <><line x1={width * 0.34} y1={inset + 5} x2={width * 0.34} y2={height - inset - 5} /><line x1={width * 0.66} y1={inset + 5} x2={width * 0.66} y2={height - inset - 5} /></> : null}{normalized === "medical_cart" ? <><circle cx={inset + 5} cy={height - 3} r="3" /><circle cx={width - inset - 5} cy={height - 3} r="3" /></> : null}</>;
  }

  if (["fridge", "microwave"].includes(normalized)) {
    return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={4} />{normalized === "fridge" ? <><line x1={inset + 4} y1={cy} x2={width - inset - 4} y2={cy} /><line x1={width - inset - 8} y1={inset + 6} x2={width - inset - 8} y2={cy - 5} /><line x1={width - inset - 8} y1={cy + 5} x2={width - inset - 8} y2={height - inset - 6} /></> : <><Rect x={inset + 6} y={inset + 6} width={width - inset * 2 - 18} height={height - inset * 2 - 12} rx={2} /><circle cx={width - inset - 6} cy={cy - 5} r="2" /><circle cx={width - inset - 6} cy={cy + 5} r="2" /></>}</>;
  }

  if (normalized === "stairs") {
    const count = 6;
    return <>{Array.from({ length: count }, (_, index) => <line key={index} x1={inset} y1={inset + ((height - inset * 2) * index) / (count - 1)} x2={width - inset} y2={inset + ((height - inset * 2) * index) / (count - 1)} />)}<path d={`M ${cx} ${height - inset} V ${inset + 4} M ${cx} ${inset + 4} L ${cx - 6} ${inset + 12} M ${cx} ${inset + 4} L ${cx + 6} ${inset + 12}`} /></>;
  }

  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={5} /><line x1={inset + 5} y1={cy} x2={width - inset - 5} y2={cy} /></>;
}

export default function FloorPlanObjectGlyph({ object, width, height, selected = false, openings = [], plan = {} }) {
  if (isMeasurementObject(object)) {
    const midY = height / 2;
    const tickHalf = Math.max(6, height);
    const label = formatLength(pxToMeters(width, plan));
    return (
      <g className={`floor-plan-object-glyph measurement ${selected ? "selected" : ""}`}>
        <line className="floor-plan-measurement-line" x1={0} y1={midY} x2={width} y2={midY} />
        <line className="floor-plan-measurement-tick" x1={0} y1={midY - tickHalf} x2={0} y2={midY + tickHalf} />
        <line className="floor-plan-measurement-tick" x1={width} y1={midY - tickHalf} x2={width} y2={midY + tickHalf} />
        <g className="floor-plan-measurement-label" transform={`translate(${width / 2}, ${midY - tickHalf - 6})`}>
          <rect x={-(label.length * 3.6 + 8)} y={-13} width={label.length * 7.2 + 16} height={18} rx={5} />
          <text textAnchor="middle" y={1}>{label}</text>
        </g>
      </g>
    );
  }

  const type = resolveSceneObjectType(object);
  const fallbackColors = {
    pc: "#2563eb",
    desktop: "#2563eb",
    computer: "#2563eb",
    workstation: "#2563eb",
    notebook: "#2563eb",
    laptop: "#2563eb",
    printer: "#475569",
    tv: "#1e293b"
  };
  const rawColor = String(object?.color || "").trim();
  const isInvisibleColor = ["#fff", "#ffffff", "white", "rgb(255, 255, 255)"].includes(rawColor.toLowerCase());
  const color = !rawColor || isInvisibleColor ? (fallbackColors[type] || "#475569") : rawColor;

  if (isWallObject(object)) {
    const cuts = openings
      .map((opening) => {
        const openingWidth = Math.min(width, Math.max(12, Number(opening.width || 0)));
        const center = Math.max(0, Math.min(width, Number(opening.metadata?.anchorOffset ?? 0.5) * width));
        return {
          start: Math.max(0, center - openingWidth / 2),
          end: Math.min(width, center + openingWidth / 2)
        };
      })
      .sort((a, b) => a.start - b.start);
    const segments = [];
    let cursor = 0;
    cuts.forEach((cut) => {
      if (cut.start > cursor) segments.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
    });
    if (cursor < width) segments.push({ start: cursor, end: width });
    return (
      <g className={`floor-plan-object-glyph wall ${selected ? "selected" : ""}`}>
        {(cuts.length ? segments : [{ start: 0, end: width }]).map((segment, index) => (
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

  if (type === "door") {
    const doorType = object?.metadata?.doorType || "single";
    const outward = object?.metadata?.swing === "outward";
    const hingeY = outward ? 2 : height - 2;
    const reverseSlide = object?.metadata?.slideDirection === "left";

    if (doorType === "double") {
      const center = width / 2;
      const openY = outward ? height - 3 : 3;
      const leftEndX = Math.max(8, center - 2);
      const rightEndX = Math.min(width - 8, center + 2);
      return (
        <g className={`floor-plan-object-glyph opening door double ${selected ? "selected" : ""}`} stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
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

    if (doorType === "sliding") {
      const panelWidth = width * 0.56;
      const firstX = reverseSlide ? width - panelWidth - 2 : 2;
      const secondX = reverseSlide ? 2 : width - panelWidth - 2;
      return (
        <g className={`floor-plan-object-glyph opening door sliding ${selected ? "selected" : ""}`} stroke={color} strokeWidth="2" fill="none">
          <line x1="0" y1={height * 0.2} x2={width} y2={height * 0.2} strokeWidth="4" />
          <rect x={firstX} y={height * 0.32} width={panelWidth} height={height * 0.44} rx="1" />
          <rect x={secondX} y={height * 0.44} width={panelWidth} height={height * 0.32} rx="1" />
          <line x1={firstX + panelWidth * 0.75} y1={height * 0.38} x2={firstX + panelWidth * 0.75} y2={height * 0.7} />
        </g>
      );
    }

    if (doorType === "pocket") {
      const pocketStart = reverseSlide ? 2 : width * 0.52;
      const panelStart = reverseSlide ? width * 0.42 : 2;
      return (
        <g className={`floor-plan-object-glyph opening door pocket ${selected ? "selected" : ""}`} stroke={color} strokeWidth="2" fill="none">
          <line x1="0" y1={height * 0.24} x2={width} y2={height * 0.24} strokeWidth="4" />
          <line x1="0" y1={height * 0.78} x2={width} y2={height * 0.78} strokeWidth="4" />
          <rect x={pocketStart} y={height * 0.15} width={width * 0.46} height={height * 0.72} rx="1" className="pocket-casing" />
          <rect x={panelStart} y={height * 0.32} width={width * 0.5} height={height * 0.42} rx="1" />
          <circle cx={panelStart + width * 0.42} cy={height * 0.53} r="1.4" />
        </g>
      );
    }

    const openY = outward ? height - 3 : 3;
    const hingeX = 7;
    const jambX = width - 7;
    return (
      <g className={`floor-plan-object-glyph opening door single ${selected ? "selected" : ""}`} stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
        <line x1="0" y1={hingeY} x2={hingeX} y2={hingeY} strokeWidth="4" />
        <line x1={jambX} y1={hingeY} x2={width} y2={hingeY} strokeWidth="4" />
        <line x1={hingeX} y1={hingeY} x2={hingeX} y2={openY} />
        <path
          d={`M ${hingeX} ${openY} Q ${jambX} ${openY} ${jambX} ${hingeY}`}
          strokeDasharray="3 2"
          opacity="0.72"
        />
        <circle cx={hingeX} cy={hingeY} r="1.6" />
      </g>
    );
  }

  if (type === "window") {
    return <g className={`floor-plan-object-glyph opening window ${selected ? "selected" : ""}`} stroke={color}><line x1="2" y1={height * 0.34} x2={width - 2} y2={height * 0.34} /><line x1="2" y1={height * 0.66} x2={width - 2} y2={height * 0.66} /><line x1={width / 2} y1="1" x2={width / 2} y2={height - 1} /></g>;
  }

  return (
    <g className={`floor-plan-object-glyph ${isOpeningObject(object) ? "opening" : "fixture"} ${selected ? "selected" : ""}`} stroke={color} fill="none">
      <DeviceGlyph type={type} width={width} height={height} metadata={object?.metadata || {}} />
    </g>
  );
}
