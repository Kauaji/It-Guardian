import { getObjectCenter } from "../utils/editorGeometry.js";

function getRouteWidth(route, routeStyle) {
  if (routeStyle === "conduit") return 10;
  if (routeStyle === "channel") return 8;
  return route.routeType === "power" ? 5 : 4;
}

export function RouteLayer({ routes, selected, onSelect }) {
  return routes.map((route) => {
    const path = route.path || [];
    if (path.length < 2) return null;
    const routeStyle = route.metadata?.routeStyle || "free";
    return (
      <polyline
        key={route.id}
        className={`floor-plan-route style-${routeStyle} ${selected?.type === "route" && selected.id === route.id ? "selected" : ""}`}
        points={path.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={route.color}
        strokeWidth={getRouteWidth(route, routeStyle)}
        strokeDasharray={routeStyle === "free" && route.routeType === "power" ? "12 8" : "0"}
        onClick={(event) => {
          event.stopPropagation();
          onSelect({ type: "route", id: route.id });
        }}
      />
    );
  });
}

export function PowerLinkLayer({ powerLinks }) {
  return powerLinks.map(({ accessory, target }) => {
    const accessoryCenter = getObjectCenter(accessory);
    const targetCenter = getObjectCenter(target);
    return (
      <line
        className="floor-plan-power-link"
        key={`${accessory.id}-${target.id}`}
        x1={accessoryCenter.x}
        y1={accessoryCenter.y}
        x2={targetCenter.x}
        y2={targetCenter.y}
      />
    );
  });
}

export function PointLayer({ points, selected, onPointerDown, onSelect }) {
  return points.map((point) => {
    const pointSelected = selected?.type === "point" && selected.id === point.id;
    return (
      <g
        key={point.id}
        className={`floor-plan-point ${pointSelected ? "selected" : ""}`}
        onPointerDown={(event) => onPointerDown(event, "point", point.id)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect({ type: "point", id: point.id });
        }}
      >
        <rect
          x={(point.x || 0) - 11}
          y={(point.y || 0) - 11}
          width="22"
          height="22"
          rx="5"
          fill="#ffffff"
          stroke={point.pointType === "power" ? "#d97706" : "#2563eb"}
          strokeWidth={pointSelected ? 4 : 2}
        />
        <text x={(point.x || 0) - 4} y={(point.y || 0) + 5}>
          {point.pointType === "power" ? "E" : "R"}
        </text>
      </g>
    );
  });
}
