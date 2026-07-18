import { Building2, Coffee, DoorOpen, Home, LampDesk, Monitor, Network, Printer, Server, Sofa, SquareStack, Warehouse } from "lucide-react";

const ROOM_COLORS = {
  office: "#93c5fd",
  meeting: "#a7f3d0",
  service: "#fde68a",
  technical: "#c4b5fd",
  support: "#fbcfe8"
};

export const ROOM_TEMPLATES = [
  {
    id: "office-small",
    label: "Escritorio pequeno",
    category: "Trabalho",
    icon: Monitor,
    width: 220,
    height: 160,
    color: ROOM_COLORS.office,
    objects: [
      { type: "desk", label: "Mesa", x: 52, y: 42, width: 96, height: 54, color: "#b08968" },
      { type: "pc", label: "PC", x: 78, y: 54, width: 54, height: 38, color: "#2563eb" }
    ]
  },
  {
    id: "office-open",
    label: "Sala operacional",
    category: "Trabalho",
    icon: LampDesk,
    width: 340,
    height: 210,
    color: ROOM_COLORS.office,
    objects: [
      { type: "desk", label: "Mesa 1", x: 54, y: 48, width: 96, height: 54, color: "#b08968" },
      { type: "desk", label: "Mesa 2", x: 188, y: 48, width: 96, height: 54, color: "#b08968" },
      { type: "pc", label: "PC", x: 78, y: 60, width: 54, height: 38, color: "#2563eb" },
      { type: "pc", label: "PC", x: 212, y: 60, width: 54, height: 38, color: "#2563eb" }
    ]
  },
  {
    id: "meeting-room",
    label: "Sala de reuniao",
    category: "Trabalho",
    icon: SquareStack,
    width: 300,
    height: 210,
    color: ROOM_COLORS.meeting,
    objects: [
      { type: "desk", label: "Mesa de reuniao", x: 82, y: 66, width: 140, height: 72, color: "#b08968" },
      { type: "tv", label: "TV", x: 132, y: 18, width: 62, height: 32, color: "#334155" }
    ]
  },
  {
    id: "reception",
    label: "Recepcao",
    category: "Atendimento",
    icon: Home,
    width: 280,
    height: 180,
    color: ROOM_COLORS.support,
    objects: [
      { type: "desk", label: "Balcao", x: 54, y: 44, width: 118, height: 52, color: "#b08968" },
      { type: "pc", label: "Terminal", x: 88, y: 54, width: 52, height: 36, color: "#2563eb" }
    ]
  },
  {
    id: "support-room",
    label: "Suporte tecnico",
    category: "Atendimento",
    icon: Building2,
    width: 300,
    height: 200,
    color: ROOM_COLORS.support,
    objects: [
      { type: "desk", label: "Bancada", x: 42, y: 52, width: 150, height: 56, color: "#b08968" },
      { type: "rack", label: "Armario", x: 218, y: 48, width: 50, height: 76, color: "#1f2937" }
    ]
  },
  {
    id: "server-room",
    label: "Sala de servidores",
    category: "Tecnico",
    icon: Server,
    width: 260,
    height: 180,
    color: ROOM_COLORS.technical,
    objects: [
      { type: "rack", label: "Rack 12U", x: 48, y: 42, width: 58, height: 82, color: "#111827" },
      { type: "server", label: "Servidor", x: 136, y: 42, width: 58, height: 82, color: "#111827" }
    ]
  },
  {
    id: "network-closet",
    label: "Rack de rede",
    category: "Tecnico",
    icon: Network,
    width: 180,
    height: 140,
    color: ROOM_COLORS.technical,
    objects: [
      { type: "rack", label: "Rack", x: 60, y: 34, width: 58, height: 78, color: "#111827" },
      { type: "switch", label: "Switch", x: 70, y: 52, width: 44, height: 20, color: "#334155" }
    ]
  },
  {
    id: "printer-room",
    label: "Ilha de impressao",
    category: "Servico",
    icon: Printer,
    width: 220,
    height: 150,
    color: ROOM_COLORS.service,
    objects: [
      { type: "printer", label: "Impressora", x: 72, y: 42, width: 76, height: 52, color: "#475569" }
    ]
  },
  {
    id: "storage-room",
    label: "Deposito TI",
    category: "Servico",
    icon: Warehouse,
    width: 240,
    height: 170,
    color: ROOM_COLORS.service,
    objects: [
      { type: "cabinet", label: "Estante", x: 42, y: 42, width: 60, height: 80, color: "#8b5e34" },
      { type: "cabinet", label: "Estoque", x: 140, y: 42, width: 60, height: 80, color: "#8b5e34" }
    ]
  },
  {
    id: "call-center",
    label: "Call center",
    category: "Atendimento",
    icon: Monitor,
    width: 360,
    height: 220,
    color: ROOM_COLORS.office,
    objects: [
      { type: "desk", label: "PA 1", x: 44, y: 48, width: 88, height: 50, color: "#b08968" },
      { type: "desk", label: "PA 2", x: 144, y: 48, width: 88, height: 50, color: "#b08968" },
      { type: "desk", label: "PA 3", x: 244, y: 48, width: 88, height: 50, color: "#b08968" }
    ]
  },
  {
    id: "lounge",
    label: "Area de descanso",
    category: "Servico",
    icon: Sofa,
    width: 280,
    height: 180,
    color: "#bfdbfe",
    objects: [
      { type: "sofa", label: "Sofa", x: 54, y: 54, width: 110, height: 48, color: "#64748b" },
      { type: "desk", label: "Mesa", x: 188, y: 62, width: 54, height: 44, color: "#b08968" }
    ]
  },
  {
    id: "kitchenette",
    label: "Copa",
    category: "Servico",
    icon: Coffee,
    width: 230,
    height: 160,
    color: "#bbf7d0",
    objects: [
      { type: "cabinet", label: "Bancada", x: 42, y: 38, width: 120, height: 38, color: "#8b5e34" }
    ]
  },
  {
    id: "training-room",
    label: "Treinamento",
    category: "Trabalho",
    icon: Monitor,
    width: 360,
    height: 240,
    color: "#c7d2fe",
    objects: [
      { type: "desk", label: "Mesa", x: 58, y: 66, width: 96, height: 50, color: "#b08968" },
      { type: "desk", label: "Mesa", x: 198, y: 66, width: 96, height: 50, color: "#b08968" },
      { type: "tv", label: "Tela", x: 154, y: 22, width: 70, height: 34, color: "#334155" }
    ]
  },
  {
    id: "security-room",
    label: "Monitoramento",
    category: "Tecnico",
    icon: Server,
    width: 280,
    height: 180,
    color: "#fca5a5",
    objects: [
      { type: "pc", label: "Console", x: 64, y: 52, width: 58, height: 42, color: "#2563eb" },
      { type: "camera", label: "Cameras", x: 154, y: 48, width: 72, height: 42, color: "#334155" }
    ]
  },
  {
    id: "corridor",
    label: "Corredor tecnico",
    category: "Circulacao",
    icon: DoorOpen,
    width: 360,
    height: 95,
    color: "#e2e8f0",
    objects: []
  }
];

export function getRoomTemplate(id) {
  return ROOM_TEMPLATES.find((template) => template.id === id) || null;
}

const ROOM_OBJECT_HEIGHTS_3D = {
  desk: 46,
  meeting_table: 46,
  pc: 68,
  notebook: 42,
  printer: 46,
  tv: 52,
  chair: 78,
  sofa: 68,
  cabinet: 96,
  shelf: 92,
  rack: 80,
  server: 80
};

export function createRoomEntitiesFromTemplate({ template, floor, planId, createId, x, y, rotation = 0 }) {
  const roomId = createId("zone");
  const zone = {
    id: roomId,
    planId,
    floorId: floor.id,
    zoneType: "room",
    groupId: null,
    segmentId: null,
    name: template.label,
    color: template.color,
    geometry: {
      x,
      y,
      width: template.width,
      height: template.height
    },
    orderIndex: 0,
    metadata: {
      room: {
        templateId: template.id,
        shape: "rect",
        rotation,
        wallThickness: 10,
        wallHeight: 110,
        metersPerGridCell: 0.5
      }
    }
  };

  const objects = (template.objects || []).map((object, index) => ({
    id: createId("object"),
    planId,
    floorId: floor.id,
    objectType: object.type,
    category: object.type === "desk" || object.type === "sofa" || object.type === "cabinet" ? "furniture" : "asset",
    label: object.label,
    linkedAssetId: null,
    groupId: null,
    segmentId: null,
    x: x + object.x,
    y: y + object.y,
    width: object.width,
    height: object.height,
    rotation: 0,
    z: 0,
    height3d: ROOM_OBJECT_HEIGHTS_3D[object.type] || 34,
    color: object.color,
    orderIndex: index,
    metadata: {
      parentRoomId: roomId,
      roomTemplateId: template.id
    }
  }));

  return { zone, objects };
}
