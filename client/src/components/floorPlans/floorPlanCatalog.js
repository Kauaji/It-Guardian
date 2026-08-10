import {
  Armchair,
  Box,
  Cable,
  Cctv,
  DoorOpen,
  Hand,
  LampDesk,
  Laptop,
  Minus,
  Monitor,
  MousePointer2,
  Network,
  PanelTop,
  Paintbrush,
  Plug,
  Printer,
  Router,
  Server,
  Tv,
  Wifi,
  Zap
} from "lucide-react";

export const FLOOR_PLAN_TOOLS = [
  { id: "select", label: "Selecionar", icon: MousePointer2 },
  { id: "pan", label: "Mover tela", icon: Hand },
  { id: "group-brush", label: "Pincel de grupo", icon: Paintbrush },
  { id: "segment-brush", label: "Pincel de segmento", icon: Paintbrush }
];

export const FLOOR_PLAN_DIVIDER_ITEM = {
  id: "divider",
  label: "Divisoria",
  icon: Minus,
  category: "structure",
  objectType: "divider",
  width: 140,
  height: 8,
  color: "#94a3b8",
  metadata: { wallHeight: 82 }
};

export const FLOOR_PLAN_CATALOG = [
  {
    id: "openings",
    label: "Portas e janelas",
    items: [
      { id: "door", label: "Porta simples", icon: DoorOpen, category: "structure", objectType: "door", width: 74, height: 24, color: "#334155", metadata: { doorType: "single", swing: "inward" } },
      { id: "door-double", label: "Porta dupla", icon: DoorOpen, category: "structure", objectType: "door", width: 108, height: 24, color: "#334155", metadata: { doorType: "double", swing: "inward" } },
      { id: "door-sliding", label: "Porta de correr", icon: PanelTop, category: "structure", objectType: "door", width: 110, height: 20, color: "#334155", metadata: { doorType: "sliding", slideDirection: "right" } },
      { id: "door-pocket", label: "Porta embutida", icon: PanelTop, category: "structure", objectType: "door", width: 110, height: 20, color: "#334155", metadata: { doorType: "pocket", slideDirection: "right" } },
      { id: "window", label: "Janela", icon: PanelTop, category: "structure", objectType: "window", width: 92, height: 16, color: "#60a5fa" },
      { id: "stairs", label: "Escada", icon: PanelTop, category: "structure", objectType: "stairs", width: 96, height: 190, color: "#64748b" }
    ]
  },
  {
    id: "furniture",
    label: "Moveis",
    items: [
      { id: "desk", label: "Mesa", icon: LampDesk, category: "furniture", objectType: "desk", width: 96, height: 54, color: "#b08968" },
      { id: "desk-corner", label: "Mesa em L", icon: LampDesk, category: "furniture", objectType: "desk_corner", width: 132, height: 108, color: "#9a6b48" },
      { id: "meeting-table", label: "Mesa de reuniao", icon: LampDesk, category: "furniture", objectType: "meeting_table", width: 150, height: 78, color: "#a16207", tags: ["mesa", "reuniao", "reunião", "conference"] },
      { id: "round-table", label: "Mesa redonda", icon: LampDesk, category: "furniture", objectType: "round_table", width: 94, height: 94, color: "#9a6b48" },
      { id: "coffee-table", label: "Mesa de centro", icon: LampDesk, category: "furniture", objectType: "coffee_table", width: 102, height: 58, color: "#b08968" },
      { id: "chair", label: "Cadeira", icon: Armchair, category: "furniture", objectType: "chair", width: 42, height: 42, color: "#64748b" },
      { id: "office-chair", label: "Cadeira de escritorio", icon: Armchair, category: "furniture", objectType: "office_chair", width: 52, height: 52, color: "#334155" },
      { id: "visitor-chair", label: "Cadeira de visitante", icon: Armchair, category: "furniture", objectType: "visitor_chair", width: 48, height: 48, color: "#64748b" },
      { id: "armchair", label: "Poltrona", icon: Armchair, category: "furniture", objectType: "armchair", width: 78, height: 78, color: "#475569" },
      { id: "sofa", label: "Sofa", icon: Armchair, category: "furniture", objectType: "sofa", width: 126, height: 62, color: "#64748b" },
      { id: "waiting-bench", label: "Banco de espera", icon: Armchair, category: "furniture", objectType: "waiting_bench", width: 138, height: 52, color: "#0f766e" },
      { id: "coffee-side-table", label: "Mesa lateral", icon: Box, category: "furniture", objectType: "side_table", width: 54, height: 46, color: "#8b5e34" },
      { id: "drawer-unit", label: "Gaveteiro", icon: Box, category: "furniture", objectType: "drawer_unit", width: 48, height: 52, color: "#8b5e34" },
      { id: "counter", label: "Balcao", icon: PanelTop, category: "furniture", objectType: "counter", width: 132, height: 54, color: "#8b5e34" },
      { id: "rack-furniture", label: "Armario", icon: Box, category: "furniture", objectType: "cabinet", width: 82, height: 52, color: "#8b5e34" },
      { id: "shelf", label: "Estante", icon: Box, category: "furniture", objectType: "shelf", width: 96, height: 40, color: "#92400e" },
      { id: "bookcase", label: "Estante de livros", icon: Box, category: "furniture", objectType: "bookcase", width: 94, height: 34, color: "#78350f" },
      { id: "coat-rack", label: "Cabideiro", icon: Box, category: "furniture", objectType: "coat_rack", width: 46, height: 46, color: "#713f12" },
      { id: "potted-plant", label: "Planta", icon: Box, category: "furniture", objectType: "potted_plant", width: 48, height: 48, color: "#15803d" },
      { id: "floor-lamp", label: "Luminaria de piso", icon: LampDesk, category: "furniture", objectType: "floor_lamp", width: 42, height: 42, color: "#ca8a04" },
      { id: "single-bed", label: "Cama de solteiro", icon: Box, category: "furniture", objectType: "single_bed", width: 96, height: 202, color: "#60a5fa" },
      { id: "double-bed", label: "Cama de casal", icon: Box, category: "furniture", objectType: "double_bed", width: 152, height: 202, color: "#60a5fa" },
      { id: "fridge", label: "Geladeira", icon: Box, category: "furniture", objectType: "fridge", width: 72, height: 70, color: "#94a3b8" },
      { id: "microwave", label: "Micro-ondas", icon: Box, category: "furniture", objectType: "microwave", width: 56, height: 42, color: "#475569" }
    ]
  },
  {
    id: "assets",
    label: "Ativos TI",
    items: [
      { id: "pc", label: "PC", icon: Monitor, category: "asset", objectType: "pc", width: 82, height: 58, color: "#2563eb" },
      { id: "monitor", label: "Monitor", icon: Monitor, category: "asset", objectType: "monitor", width: 58, height: 28, color: "#2563eb" },
      { id: "notebook", label: "Notebook", icon: Laptop, category: "asset", objectType: "notebook", width: 56, height: 36, color: "#2563eb" },
      { id: "printer", label: "Impressora", icon: Printer, category: "asset", objectType: "printer", width: 58, height: 40, color: "#475569" },
      { id: "switch", label: "Switch", icon: Network, category: "asset", objectType: "switch", width: 96, height: 36, color: "#334155" },
      { id: "rack", label: "Rack 12U", icon: Box, category: "asset", objectType: "rack", width: 70, height: 92, color: "#1f2937" },
      { id: "wall-rack", label: "Rack de parede", icon: Box, category: "asset", objectType: "wall_rack", width: 64, height: 46, color: "#334155" },
      { id: "access-point", label: "Access Point", icon: Wifi, category: "asset", objectType: "access_point", width: 62, height: 62, color: "#64748b" },
      { id: "server", label: "Servidor", icon: Server, category: "asset", objectType: "server", width: 78, height: 88, color: "#111827" },
      { id: "router", label: "Roteador", icon: Router, category: "asset", objectType: "router", width: 78, height: 44, color: "#0f766e" },
      { id: "tv", label: "TV", icon: Tv, category: "asset", objectType: "tv", width: 76, height: 34, color: "#334155", tags: ["televisao", "televisão", "tela", "display"] },
      { id: "speaker", label: "Caixa de som", icon: Tv, category: "asset", objectType: "speaker", width: 28, height: 26, color: "#1e293b" },
      { id: "radio", label: "Radio", icon: Tv, category: "asset", objectType: "radio", width: 52, height: 24, color: "#334155" },
      { id: "ip-phone", label: "Telefone IP", icon: Monitor, category: "asset", objectType: "ip_phone", width: 28, height: 22, color: "#0f766e" },
      { id: "camera", label: "Camera", icon: Cctv, category: "asset", objectType: "camera", width: 54, height: 42, color: "#334155" },
      { id: "patch-panel", label: "Patch panel", icon: Network, category: "asset", objectType: "patch_panel", width: 96, height: 28, color: "#334155" },
      { id: "ups", label: "Nobreak", icon: Zap, category: "asset", objectType: "ups", width: 58, height: 54, color: "#1f2937" }
    ]
  },
  {
    id: "hospital",
    label: "Hospitalar",
    items: [
      { id: "hospital-bed", label: "Leito hospitalar", icon: Box, category: "hospital", objectType: "hospital_bed", width: 96, height: 210, color: "#e2e8f0" },
      { id: "stretcher", label: "Maca", icon: Box, category: "hospital", objectType: "stretcher", width: 76, height: 190, color: "#cbd5e1" },
      { id: "medical-cart", label: "Carrinho medico", icon: Box, category: "hospital", objectType: "medical_cart", width: 62, height: 46, color: "#f8fafc" },
      { id: "nurse-station", label: "Posto de enfermagem", icon: PanelTop, category: "hospital", objectType: "nurse_station", width: 168, height: 66, color: "#0f766e" },
      { id: "medical-equipment", label: "Equipamento medico", icon: Box, category: "hospital", objectType: "generic_medical_equipment", width: 66, height: 56, color: "#f8fafc", tags: ["equipamento", "medico", "médico", "hospital"] },
      { id: "reception-counter", label: "Balcao de recepcao", icon: PanelTop, category: "hospital", objectType: "reception_counter", width: 150, height: 60, color: "#94a3b8" },
      { id: "waiting-chair", label: "Cadeira de espera", icon: Armchair, category: "hospital", objectType: "waiting_chair", width: 46, height: 46, color: "#0f766e" }
    ]
  },
  {
    id: "network",
    label: "Rede",
    items: [
      { id: "network-point", label: "Ponto RJ45", icon: Network, category: "point", pointType: "network", color: "#2563eb" },
      { id: "network-route", label: "Cabo de rede", icon: Cable, category: "route", routeType: "network", color: "#2563eb", metadata: { routeStyle: "free" } },
      { id: "network-conduit", label: "Eletroduto de rede", icon: Cable, category: "route", routeType: "network", color: "#475569", metadata: { routeStyle: "conduit" } },
      { id: "network-channel", label: "Canaleta de rede", icon: Cable, category: "route", routeType: "network", color: "#64748b", metadata: { routeStyle: "channel" } }
    ]
  },
  {
    id: "energy",
    label: "Energia",
    items: [
      { id: "power-point", label: "Tomada", icon: Plug, category: "point", pointType: "power", color: "#f59e0b" },
      { id: "power-route", label: "Cabo energia", icon: Cable, category: "route", routeType: "power", color: "#f59e0b", metadata: { routeStyle: "free" } },
      { id: "power-conduit", label: "Eletroduto de energia", icon: Cable, category: "route", routeType: "power", color: "#78716c", metadata: { routeStyle: "conduit" } },
      { id: "power-channel", label: "Canaleta de energia", icon: Cable, category: "route", routeType: "power", color: "#a16207", metadata: { routeStyle: "channel" } },
      { id: "stabilizer-600", label: "Estabilizador 600V", icon: Zap, category: "power", objectType: "stabilizer_600", width: 66, height: 48, color: "#d97706", metadata: { connectableToAssets: true, capacity: "600V" } },
      { id: "stabilizer-1000", label: "Estabilizador 1000V", icon: Zap, category: "power", objectType: "stabilizer_1000", width: 76, height: 54, color: "#c2410c", metadata: { connectableToAssets: true, capacity: "1000V" } },
      { id: "extension-cord", label: "Extensao", icon: Cable, category: "power", objectType: "extension_cord", width: 92, height: 24, color: "#92400e", metadata: { connectableToAssets: true } },
      { id: "power-strip", label: "Regua de tomadas", icon: Plug, category: "power", objectType: "power_strip", width: 104, height: 28, color: "#7c2d12", metadata: { connectableToAssets: true } },
      { id: "energy-panel", label: "Quadro de energia", icon: Zap, category: "power", objectType: "energy_panel", width: 64, height: 18, color: "#78716c" },
      { id: "junction-box", label: "Caixa de passagem", icon: Box, category: "power", objectType: "junction_box", width: 34, height: 34, color: "#a16207" }
    ]
  },
  {
    id: "brushes",
    label: "Pinceis",
    items: [
      { id: "group-zone", label: "Pincel de grupo", icon: Paintbrush, category: "zone", zoneType: "group", width: 280, height: 180, color: "#8b5cf6" },
      { id: "segment-zone", label: "Pincel de segmento", icon: Paintbrush, category: "zone", zoneType: "segment", width: 210, height: 140, color: "#22c55e" }
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
