export const demoGroups = [
  { id: "demo-group-infra", name: "Infraestrutura", color: "#2563eb" },
  { id: "demo-group-workstations", name: "Estações e Atendimento", color: "#16a34a" },
  { id: "demo-group-network", name: "Rede e Periféricos", color: "#f59e0b" }
];

export const demoSegments = [
  { id: "demo-segment-servers", name: "Servidores", color: "#2563eb", groupId: "demo-group-infra" },
  { id: "demo-segment-workstations", name: "Estações administrativas", color: "#16a34a", groupId: "demo-group-workstations" },
  { id: "demo-segment-cashier", name: "Caixas e atendimento", color: "#0ea5e9", groupId: "demo-group-workstations" },
  { id: "demo-segment-printers", name: "Impressoras", color: "#d97706", groupId: "demo-group-network" },
  { id: "demo-segment-network", name: "Rede e segurança", color: "#7c3aed", groupId: "demo-group-network" }
];

export const demoAssignments = [
  ["srv-web-01", "demo-segment-servers"],
  ["srv-db-01", "demo-segment-servers"],
  ["srv-app-02", "demo-segment-servers"],
  ["srv-bkp-01", "demo-segment-servers"],
  ["srv-files-01", "demo-segment-servers"],
  ["srv-auth-01", "demo-segment-servers"],
  ["srv-erp-01", "demo-segment-servers"],
  ["srv-vmhost-02", "demo-segment-servers"],
  ["fw-edge-01", "demo-segment-network"],
  ["sw-core-01", "demo-segment-network"],
  ["cam-nvr-01", "demo-segment-network"],
  ["ws-fin-07", "demo-segment-workstations"],
  ["ws-adm-03", "demo-segment-workstations"],
  ["ws-rh-12", "demo-segment-workstations"],
  ["ws-aud-04", "demo-segment-workstations"],
  ["ws-contab-01", "demo-segment-workstations"],
  ["ws-contab-02", "demo-segment-workstations"],
  ["ws-juridico-01", "demo-segment-workstations"],
  ["ws-compras-04", "demo-segment-workstations"],
  ["ws-logistica-06", "demo-segment-workstations"],
  ["ws-suporte-02", "demo-segment-workstations"],
  ["nb-diretoria-01", "demo-segment-workstations"],
  ["nb-vendas-05", "demo-segment-workstations"],
  ["nb-comercial-02", "demo-segment-workstations"],
  ["nb-gerencia-03", "demo-segment-workstations"],
  ["nb-ti-01", "demo-segment-workstations"],
  ["ws-caixa-01", "demo-segment-cashier"],
  ["ws-caixa-02", "demo-segment-cashier"],
  ["ws-caixa-03", "demo-segment-cashier"],
  ["kiosk-rec-01", "demo-segment-cashier"],
  ["prd-print-01", "demo-segment-printers"],
  ["prd-print-02", "demo-segment-printers"],
  ["manual-printer-rh", "demo-segment-printers"],
  ["manual-printer-financeiro", "demo-segment-printers"],
  ["manual-printer-expedicao", "demo-segment-printers"],
  ["manual-switch-acesso-01", "demo-segment-network"],
  ["manual-switch-acesso-02", "demo-segment-network"],
  ["manual-ap-recepcao", "demo-segment-network"],
  ["manual-ap-financeiro", "demo-segment-network"],
  ["manual-ap-estoque", "demo-segment-network"],
  ["manual-nas-arquivos-01", "demo-segment-network"],
  ["manual-router-link-02", "demo-segment-network"],
  ["manual-camera-galpao", "demo-segment-network"],
  ["manual-camera-recepcao-01", "demo-segment-network"],
  ["manual-camera-caixa-01", "demo-segment-network"]
];

export const demoBackups = [
  { id: "nb-comercial-02", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" },
  { id: "ws-suporte-02", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" },
  { id: "nb-ti-01", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" }
];
