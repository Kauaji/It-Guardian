/** Padroes de grade, fundo branco, imagem de fundo e grade do canvas. */
export default function CanvasBackdrop({ width, height, gridSize, showGrid, backgroundSrc, backgroundSettings }) {
  const fineGrid = Math.max(4, gridSize / 5);
  return (
    <>
      <defs>
        <pattern id="floor-grid-fine" width={fineGrid} height={fineGrid} patternUnits="userSpaceOnUse">
          <path d={`M ${fineGrid} 0 L 0 0 0 ${fineGrid}`} fill="none" stroke="#edf4fc" strokeWidth="0.7" />
        </pattern>
        <pattern id="floor-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#dbeafe" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="#fbfdff" />
      {backgroundSrc ? (
        <image
          className="floor-plan-background-image"
          href={backgroundSrc}
          x={Number(backgroundSettings.x || 0)}
          y={Number(backgroundSettings.y || 0)}
          width={Number(backgroundSettings.width || width)}
          height={Number(backgroundSettings.height || height)}
          opacity={Number(backgroundSettings.opacity ?? 0.72)}
          preserveAspectRatio={backgroundSettings.fit === "stretch" ? "none" : "xMidYMid meet"}
          pointerEvents="none"
        />
      ) : null}
      {showGrid ? (
        <>
          <rect x="0" y="0" width={width} height={height} fill="url(#floor-grid-fine)" />
          <rect x="0" y="0" width={width} height={height} fill="url(#floor-grid)" />
        </>
      ) : null}
    </>
  );
}
