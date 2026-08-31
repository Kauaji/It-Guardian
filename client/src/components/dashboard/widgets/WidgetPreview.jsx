import { visualizationLabels } from "./widgetVisualizations.js";

// Deliberately illustrative. Real numbers are only shown by the actual widget.
export default function WidgetPreview({ variant = "bars" }) {
  const colors = ["#1f7a61", "#3974cc", "#d69a21", "#a5bacb"];
  return (
    <div className="dashboard-visual-preview" role="img" aria-label={"Prévia ilustrativa: " + (visualizationLabels[variant] || variant)}>
      <svg viewBox="0 0 240 104" aria-hidden="true" focusable="false">
        {(variant === "pie" || variant === "donut") ? (
          <g>
            <circle cx="84" cy="52" r="35" fill={variant === "pie" ? colors[0] : "none"} stroke={colors[0]} strokeWidth={variant === "pie" ? 0 : 16} />
            {variant === "pie" ? <path d="M84 52 L84 17 A35 35 0 0 1 114 70 Z" fill={colors[1]} /> : <circle cx="84" cy="52" r="35" fill="none" stroke={colors[1]} strokeWidth="16" strokeDasharray="75 145" transform="rotate(-90 84 52)" />}
            {colors.slice(0, 3).map((color, i) => <g key={color}><rect x="145" y={27 + i * 22} width="7" height="7" rx="2" fill={color} /><rect x="159" y={28 + i * 22} width={48 - i * 7} height="5" rx="2" fill="currentColor" opacity=".2" /></g>)}
          </g>
        ) : variant === "line" || variant === "area" ? (
          <g>
            {[25, 50, 75].map((y) => <path key={y} d={"M18 " + y + "H224"} stroke="currentColor" opacity=".1" />)}
            {variant === "area" && <path d="M18 76 L48 62 L76 69 L106 36 L136 49 L165 26 L195 34 L224 15 V91 H18Z" fill={colors[0]} opacity=".15" />}
            <path d="M18 76 L48 62 L76 69 L106 36 L136 49 L165 26 L195 34 L224 15" fill="none" stroke={colors[0]} strokeWidth="3" strokeLinejoin="round" />
          </g>
        ) : variant === "columns" ? (
          <g>
            <path d="M20 90H222" stroke="currentColor" opacity=".15" />
            {[49, 70, 35, 58, 80, 46].map((height, i) => <rect key={i} x={27 + i * 32} y={90 - height} width="20" height={height} rx="3" fill={colors[i % colors.length]} />)}
          </g>
        ) : variant === "gauge" ? (
          <g fill="none" strokeWidth="11"><circle cx="120" cy="52" r="34" stroke="currentColor" opacity=".1" /><circle cx="120" cy="52" r="34" stroke={colors[0]} strokeDasharray="154 60" transform="rotate(-90 120 52)" /></g>
        ) : variant === "radial" ? (
          <g fill="none" transform="rotate(-90 86 52)">
            {[35, 27, 19, 11].map((radius, index) => <g key={radius}><circle cx="86" cy="52" r={radius} stroke="currentColor" strokeWidth="6" opacity=".1" /><circle cx="86" cy="52" r={radius} stroke={colors[index]} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.round(2 * Math.PI * radius * ([.88, .67, .52, .34][index]))} 260`} /></g>)}
          </g>
        ) : variant === "heatmap" ? (
          <g>
            {[0, 1, 2, 3, 4, 5].map((index) => <g key={index} transform={`translate(${18 + (index % 3) * 71} ${12 + Math.floor(index / 3) * 44})`}><rect width="62" height="36" rx="5" fill={colors[index % colors.length]} opacity={.12 + index * .09} /><rect x="8" y="8" width={35 - (index % 3) * 5} height="4" rx="2" fill="currentColor" opacity=".3" /><g transform="translate(8 23)">{[0, 1, 2, 3, 4].map((cell) => <rect key={cell} x={cell * 9} width="7" height="5" rx="1.5" fill={colors[index % colors.length]} opacity={cell <= index % 5 ? 1 : .18} />)}</g></g>)}
          </g>
        ) : variant === "stats" ? (
          <g>{[0, 1, 2, 3, 4, 5].map((index) => <g key={index} transform={"translate(" + (18 + (index % 3) * 71) + " " + (12 + Math.floor(index / 3) * 44) + ")"}><rect width="62" height="36" rx="5" fill={colors[0]} opacity=".09" /><rect x="9" y="9" width="32" height="4" rx="2" fill="currentColor" opacity=".25" /><rect x="9" y="20" width="19" height="7" rx="2" fill={colors[0]} /></g>)}</g>
        ) : (
          <g>{[176, 129, 94, 62].map((width, i) => <g key={i}><rect x="18" y={15 + i * 22} width={variant === "list" ? 204 : width} height="10" rx="3" fill={variant === "list" ? "currentColor" : colors[i]} opacity={variant === "list" ? .12 : 1} />{variant === "list" && <rect x="191" y={15 + i * 22} width="30" height="10" rx="3" fill={colors[i]} />}</g>)}</g>
        )}
      </svg>
      <span>Prévia ilustrativa</span>
    </div>
  );
}
