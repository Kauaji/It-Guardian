export default function Rect({ x = 0, y = 0, width, height, rx = 2, className = "" }) {
  return <rect className={className} x={x} y={y} width={width} height={height} rx={rx} />;
}
