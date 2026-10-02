import Rect from "./Rect.jsx";

/**
 * Glifos de planta baixa de mobiliario. Cada funcao recebe o contexto
 * `{ type, width, height, cx, cy, inset, metadata }` e devolve o desenho.
 */

export function deskCornerGlyph({ width, height, inset }) {
  const thickness = Math.max(12, Math.min(width, height) * 0.34);
  return (
    <>
      <path d={`M ${inset} ${inset} H ${width - inset} V ${inset + thickness} H ${inset + thickness} V ${height - inset} H ${inset} Z`} />
      <line x1={inset + 7} y1={inset + 5} x2={width - inset - 7} y2={inset + 5} />
      <line x1={inset + 5} y1={inset + 7} x2={inset + 5} y2={height - inset - 7} />
    </>
  );
}

export function roundTableGlyph({ type, width, height, cx, cy }) {
  const rx = type === "round_table" ? Math.min(width, height) * 0.38 : width * 0.38;
  const ry = type === "round_table" ? Math.min(width, height) * 0.38 : height * 0.3;
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      <ellipse cx={cx} cy={cy} rx={Math.max(4, rx - 6)} ry={Math.max(4, ry - 6)} opacity="0.45" />
      <circle cx={cx} cy={cy} r="2.5" />
    </>
  );
}

export function tableGlyph({ type, width, height, cx, inset }) {
  const meeting = type.includes("meeting");
  return (
    <>
      <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={meeting ? 12 : 4} />
      <line x1={inset + 6} y1={inset + 5} x2={inset + 6} y2={height - inset - 5} />
      <line x1={width - inset - 6} y1={inset + 5} x2={width - inset - 6} y2={height - inset - 5} />
      {meeting ? <line x1={cx} y1={inset + 5} x2={cx} y2={height - inset - 5} /> : null}
    </>
  );
}

export function chairGlyph({ width, height, cx, cy }) {
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

export function officeChairGlyph({ width, height, cx, cy }) {
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

export function armchairGlyph({ width, height, inset }) {
  return (
    <>
      <Rect x={inset} y={inset + 4} width={width - inset * 2} height={height - inset * 2 - 4} rx={10} />
      <Rect x={inset + 8} y={inset + 10} width={width - inset * 2 - 16} height={height - inset * 2 - 18} rx={7} />
      <line x1={inset + 6} y1={inset + 6} x2={width - inset - 6} y2={inset + 6} />
    </>
  );
}

/** Mesa lateral, cabideiro, vaso de planta e luminaria de piso. */
export function smallFurnitureGlyph({ type, width, height, cx, cy, inset }) {
  if (type === "potted_plant") {
    return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.24} /><path d={`M ${cx} ${cy} C ${cx - 18} ${cy - 18}, ${cx - 22} ${cy + 8}, ${cx} ${cy + 2} C ${cx + 18} ${cy + 18}, ${cx + 22} ${cy - 8}, ${cx} ${cy - 2}`} /><circle cx={cx} cy={cy} r="3" /></>;
  }
  if (type === "coat_rack") {
    return <><circle cx={cx} cy={cy} r="5" /><line x1={cx} y1={inset} x2={cx} y2={height - inset} /><line x1={cx} y1={cy} x2={inset} y2={height - inset} /><line x1={cx} y1={cy} x2={width - inset} y2={height - inset} /><path d={`M ${cx} ${inset + 3} L ${cx - 10} ${inset + 13} M ${cx} ${inset + 3} L ${cx + 10} ${inset + 13}`} /></>;
  }
  if (type === "floor_lamp") {
    return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.32} /><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.16} /><line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} /></>;
  }
  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={3} /><line x1={inset + 4} y1={cy} x2={width - inset - 4} y2={cy} /><circle cx={width - inset - 7} cy={cy - 5} r="1.7" /></>;
}

export function bedGlyph({ type, width, height, inset }) {
  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={6} /><Rect x={inset + 5} y={inset + 5} width={width - inset * 2 - 10} height={Math.max(12, height * 0.22)} rx={5} /><line x1={inset - 2} y1={height * 0.25} x2={inset - 2} y2={height * 0.75} /><line x1={width - inset + 2} y1={height * 0.25} x2={width - inset + 2} y2={height * 0.75} />{type === "stretcher" ? <><circle cx={inset + 3} cy={height - 3} r="3" /><circle cx={width - inset - 3} cy={height - 3} r="3" /></> : null}</>;
}

/** Carrinho medico, balcoes, sofa e banco de espera. */
export function counterGlyph({ type, width, height, cy, inset }) {
  const cushioned = ["sofa", "waiting_bench"].includes(type);
  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={cushioned ? 10 : 3} /><line x1={inset + 5} y1={cy} x2={width - inset - 5} y2={cy} />{cushioned ? <><line x1={width * 0.34} y1={inset + 5} x2={width * 0.34} y2={height - inset - 5} /><line x1={width * 0.66} y1={inset + 5} x2={width * 0.66} y2={height - inset - 5} /></> : null}{type === "medical_cart" ? <><circle cx={inset + 5} cy={height - 3} r="3" /><circle cx={width - inset - 5} cy={height - 3} r="3" /></> : null}</>;
}

export function kitchenGlyph({ type, width, height, cy, inset }) {
  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={4} />{type === "fridge" ? <><line x1={inset + 4} y1={cy} x2={width - inset - 4} y2={cy} /><line x1={width - inset - 8} y1={inset + 6} x2={width - inset - 8} y2={cy - 5} /><line x1={width - inset - 8} y1={cy + 5} x2={width - inset - 8} y2={height - inset - 6} /></> : <><Rect x={inset + 6} y={inset + 6} width={width - inset * 2 - 18} height={height - inset * 2 - 12} rx={2} /><circle cx={width - inset - 6} cy={cy - 5} r="2" /><circle cx={width - inset - 6} cy={cy + 5} r="2" /></>}</>;
}

export function stairsGlyph({ width, height, cx, inset }) {
  const count = 6;
  return <>{Array.from({ length: count }, (_, index) => <line key={index} x1={inset} y1={inset + ((height - inset * 2) * index) / (count - 1)} x2={width - inset} y2={inset + ((height - inset * 2) * index) / (count - 1)} />)}<path d={`M ${cx} ${height - inset} V ${inset + 4} M ${cx} ${inset + 4} L ${cx - 6} ${inset + 12} M ${cx} ${inset + 4} L ${cx + 6} ${inset + 12}`} /></>;
}

export function fallbackGlyph({ width, height, cy, inset }) {
  return <><Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={5} /><line x1={inset + 5} y1={cy} x2={width - inset - 5} y2={cy} /></>;
}
