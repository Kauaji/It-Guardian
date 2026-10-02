import Rect from "./Rect.jsx";

/**
 * Glifos de planta baixa de equipamentos de TI, audiovisual e energia. Mesmo
 * contexto dos glifos de mobiliario.
 */

export function computerGlyph({ width, height, inset }) {
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

export function laptopGlyph({ width, height, cx, inset }) {
  return (
    <>
      <Rect x={inset} y={inset} width={width - inset * 2} height={height * 0.54} rx={3} />
      <path d={`M ${inset - 3} ${height * 0.72} L ${width - inset + 3} ${height * 0.72} L ${width - inset - 2} ${height - inset} L ${inset + 2} ${height - inset} Z`} />
      <line x1={cx - 5} y1={height * 0.82} x2={cx + 5} y2={height * 0.82} />
    </>
  );
}

export function printerGlyph({ width, height, inset }) {
  return (
    <>
      <Rect x={inset + 4} y={inset} width={width - inset * 2 - 8} height={height * 0.34} rx={2} />
      <Rect x={inset} y={height * 0.34} width={width - inset * 2} height={height * 0.46} rx={5} />
      <Rect x={inset + 7} y={height * 0.62} width={width - inset * 2 - 14} height={height * 0.25} rx={1} />
      <circle cx={width - inset - 7} cy={height * 0.47} r="2" />
    </>
  );
}

/** Armario, estante, rack e servidor (rack com switch mostra as portas). */
export function cabinetGlyph({ type, width, height, inset, metadata }) {
  const rackWithSwitch = type.includes("rack") && metadata.switchInstalled;
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

export function networkBoxGlyph({ type, width, height, cy, inset }) {
  return (
    <>
      <Rect x={inset} y={height * 0.28} width={width - inset * 2} height={height * 0.44} rx={4} />
      {[0.26, 0.38, 0.5, 0.62].map((ratio) => <circle key={ratio} cx={width * ratio} cy={cy} r="1.8" />)}
      {type === "router" ? <><line x1={inset + 4} y1={height * 0.28} x2={inset} y2={inset} /><line x1={width - inset - 4} y1={height * 0.28} x2={width - inset} y2={inset} /></> : null}
    </>
  );
}

export function accessPointGlyph({ width, height, cx, cy }) {
  return <><circle cx={cx} cy={cy} r={Math.min(width, height) * 0.3} /><circle cx={cx} cy={cy} r="3" /><path d={`M ${cx - 12} ${cy - 1} Q ${cx} ${cy - 14} ${cx + 12} ${cy - 1}`} /></>;
}

export function tvGlyph({ width, height, cx }) {
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

export function audioGlyph({ type, width, height, cx, cy, inset }) {
  return (
    <>
      <Rect x={inset} y={inset} width={width - inset * 2} height={height - inset * 2} rx={3} />
      {type === "speaker" ? (
        <><circle cx={cx} cy={cy - 6} r={Math.min(width, height) * 0.12} /><circle cx={cx} cy={cy + 7} r={Math.min(width, height) * 0.2} /></>
      ) : (
        <><line x1={inset + 6} y1={cy - 4} x2={width - inset - 6} y2={cy - 4} /><circle cx={width - inset - 10} cy={cy + 7} r="4" /><line x1={inset + 6} y1={cy + 7} x2={cx} y2={cy + 7} /></>
      )}
    </>
  );
}

export function cameraGlyph({ width, cy, inset }) {
  return <><path d={`M ${inset} ${cy - 8} H ${width * 0.7} L ${width - inset} ${cy} L ${width * 0.7} ${cy + 8} H ${inset} Z`} /><circle cx={width * 0.68} cy={cy} r="4" /></>;
}

/** Estabilizadores, reguas de tomadas e extensoes. */
export function powerGlyph({ width, height, cy, inset }) {
  return <><Rect x={inset} y={height * 0.28} width={width - inset * 2} height={height * 0.44} rx={5} />{[0.3, 0.5, 0.7].map((ratio) => <circle key={ratio} cx={width * ratio} cy={cy} r="3" />)}<path d={`M ${width - inset} ${cy} Q ${width + 7} ${cy} ${width - 2} ${height - 3}`} /></>;
}
