import {
  Box,
  Building2,
  Cable,
  DoorOpen,
  Eraser,
  Hand,
  LampDesk,
  Laptop,
  Minus,
  MousePointer2,
  Network,
  PanelTop,
  Paintbrush,
  Plug,
  Printer,
  Router,
  Server,
  Shield,
  Square,
  Wifi,
  Zap
} from "lucide-react";

export const FLOOR_PLAN_TOOLS = [
  { id: "select", label: "Selecionar", icon: MousePointer2 },
  { id: "pan", label: "Mover tela", icon: Hand },
  { id: "group-brush", label: "Pincel de grupo", icon: Paintbrush },
  { id: "segment-brush", label: "Pincel de segmento", icon: Square },
  { id: "eraser", label: "Borracha", icon: Eraser }
];

export const FLOOR_PLAN_CATALOG = [
  {
    id: "structure",
    label: "Estrutura",
    items: [
      { id: "wall", label: "Parede", icon: Minus, category: "structure", objectType: "wall", width: 180, height: 12, color: "#64748b", metadata: { wallHeight: 110 } },
      { id: "divider", label: "Divisoria", icon: Minus, category: "structure", objectType: "divider", width: 140, height: 8, color: "#94a3b8", metadata: { wallHeight: 82 } }
    ]
  },
  {
    id: "openings",
    label: "Portas e janelas",
    items: [
      { id: "door", label: "Porta", icon: DoorOpen, category: "structure", objectType: "door", width: 74, height: 20, color: "#8b5e34", metadata: { swing: "inward" } },
      { id: "window", label: "Janela", icon: PanelTop, category: "structure", objectType: "window", width: 92, height: 16, color: "#60a5fa" }
    ]
  },
  {
    id: "furniture",
    label: "Moveis",
    items: [
      { id: "desk", label: "Mesa", icon: LampDesk, category: "furniture", objectType: "desk", width: 110, height: 64, color: "#b08968" },
      { id: "chair", label: "Cadeira", icon: Square, category: "furniture", objectType: "chair", width: 42, height: 42, color: "#64748b" },
      { id: "rack-furniture", label: "Armario", icon: Box, category: "furniture", objectType: "cabinet", width: 82, height: 52, color: "#8b5e34" }
    ]
  },
  {
    id: "assets",
    label: "Ativos TI",
    items: [
      { id: "pc", label: "PC", icon: PanelTop, category: "asset", objectType: "pc", width: 82, height: 58, color: "#2563eb" },
      { id: "notebook", label: "Notebook", icon: Laptop, category: "asset", objectType: "notebook", width: 78, height: 48, color: "#2563eb" },
      { id: "printer", label: "Impressora", icon: Printer, category: "asset", objectType: "printer", width: 84, height: 56, color: "#475569" },
      { id: "switch", label: "Switch", icon: Network, category: "asset", objectType: "switch", width: 96, height: 36, color: "#334155" },
      { id: "rack", label: "Rack 12U", icon: Box, category: "asset", objectType: "rack", width: 70, height: 92, color: "#1f2937" },
      { id: "access-point", label: "Access Point", icon: Wifi, category: "asset", objectType: "access_point", width: 62, height: 62, color: "#64748b" },
      { id: "server", label: "Servidor", icon: Server, category: "asset", objectType: "server", width: 78, height: 88, color: "#111827" },
      { id: "firewall", label: "Firewall", icon: Shield, category: "asset", objectType: "firewall", width: 88, height: 40, color: "#7f1d1d" },
      { id: "router", label: "Roteador", icon: Router, category: "asset", objectType: "router", width: 78, height: 44, color: "#0f766e" },
      { id: "camera", label: "Camera", icon: Building2, category: "asset", objectType: "camera", width: 54, height: 42, color: "#334155" }
    ]
  },
  {
    id: "network",
    label: "Rede",
    items: [
      { id: "network-point", label: "Ponto RJ45", icon: Network, category: "point", pointType: "network", color: "#2563eb" },
      { id: "network-route", label: "Cabo de rede", icon: Cable, category: "route", routeType: "network", color: "#2563eb" }
    ]
  },
  {
    id: "energy",
    label: "Energia",
    items: [
      { id: "power-point", label: "Tomada", icon: Plug, category: "point", pointType: "power", color: "#f59e0b" },
      { id: "power-route", label: "Cabo energia", icon: Cable, category: "route", routeType: "power", color: "#f59e0b" },
      { id: "stabilizer-600", label: "Estabilizador 600V", icon: Zap, category: "power", objectType: "stabilizer_600", width: 66, height: 48, color: "#d97706", metadata: { connectableToAssets: true, capacity: "600V" } },
      { id: "stabilizer-1000", label: "Estabilizador 1000V", icon: Zap, category: "power", objectType: "stabilizer_1000", width: 76, height: 54, color: "#c2410c", metadata: { connectableToAssets: true, capacity: "1000V" } },
      { id: "extension-cord", label: "Extensao", icon: Cable, category: "power", objectType: "extension_cord", width: 92, height: 24, color: "#92400e", metadata: { connectableToAssets: true } },
      { id: "power-strip", label: "Regua de tomadas", icon: Plug, category: "power", objectType: "power_strip", width: 104, height: 28, color: "#7c2d12", metadata: { connectableToAssets: true } }
    ]
  },
  {
    id: "brushes",
    label: "Pinceis",
    items: [
      { id: "group-zone", label: "Area de grupo", icon: Paintbrush, category: "zone", zoneType: "group", width: 280, height: 180, color: "#8b5cf6" },
      { id: "segment-zone", label: "Area de segmento", icon: Square, category: "zone", zoneType: "segment", width: 210, height: 140, color: "#22c55e" }
    ]
  }
];

export function getCatalogItem(id) {
  for (const section of FLOOR_PLAN_CATALOG) {
    const item = section.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return null;
}
