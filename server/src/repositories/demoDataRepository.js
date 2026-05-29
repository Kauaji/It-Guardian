import { query } from "../database.js";

const demoGroups = [
  { id: "demo-group-infra", name: "Infraestrutura", color: "#2563eb" },
  { id: "demo-group-workstations", name: "Estações e Atendimento", color: "#16a34a" },
  { id: "demo-group-network", name: "Rede e Periféricos", color: "#f59e0b" }
];

const demoSegments = [
  { id: "demo-segment-servers", name: "Servidores", color: "#2563eb", groupId: "demo-group-infra" },
  { id: "demo-segment-workstations", name: "Estações administrativas", color: "#16a34a", groupId: "demo-group-workstations" },
  { id: "demo-segment-cashier", name: "Caixas e atendimento", color: "#0ea5e9", groupId: "demo-group-workstations" },
  { id: "demo-segment-printers", name: "Impressoras", color: "#d97706", groupId: "demo-group-network" },
  { id: "demo-segment-network", name: "Rede e segurança", color: "#7c3aed", groupId: "demo-group-network" }
];

const demoAssignments = [
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

const demoBackups = [
  { id: "nb-comercial-02", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" },
  { id: "ws-suporte-02", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" },
  { id: "nb-ti-01", segmentId: "demo-segment-workstations", segmentName: "Estações administrativas" }
];

const demoTechnicians = [
  ["demo-tech-ana", "Ana Ribeiro", "ana.ribeiro@itguardian.local", "(11) 98800-1101", "Técnica N2", "Hardware e redes"],
  ["demo-tech-bruno", "Bruno Lima", "bruno.lima@itguardian.local", "(11) 98800-1102", "Técnico N1", "Atendimento e sistemas"],
  ["demo-tech-carla", "Carla Mendes", "carla.mendes@itguardian.local", "(11) 98800-1103", "Especialista", "Servidores e virtualização"],
  ["demo-tech-diego", "Diego Santos", "diego.santos@itguardian.local", "(11) 98800-1104", "Técnico N2", "Impressoras e periféricos"]
];

const demoClients = [
  ["demo-client-alfa", "Alfa Comercio", "Alfa Comercio e Servicos Ltda", "00.000.000/0001-01", "(11) 3333-0101", "contato@alfa.local", "Unidade Centro", "Equipe Alfa"],
  ["demo-client-beta", "Beta Logistica", "Beta Logistica Integrada Ltda", "00.000.000/0001-02", "(11) 3333-0202", "suporte@beta.local", "CD Norte", "Operacao Beta"],
  ["demo-client-orion", "Orion Saude", "Orion Saude Corporativa Ltda", "00.000.000/0001-03", "(11) 3333-0303", "ti@orion.local", "Unidade Administrativa", "TI Orion"]
];

const demoProducts = [
  ["demo-part-ssd-480", "SSD 480GB SATA", "Armazenamento", "Kingston", "A400 480GB", "PEC-SSD-480", 8, 220, "un"],
  ["demo-part-ram-8", "Memória RAM 8GB DDR4", "Memória", "Crucial", "DDR4 2666", "PEC-RAM-8DDR4", 12, 145, "un"],
  ["demo-part-fonte", "Fonte ATX 500W", "Energia", "Corsair", "CV500", "PEC-FNT-500", 5, 280, "un"],
  ["demo-part-toner", "Toner HP 58A", "Impressão", "HP", "CF258A", "PEC-TON-58A", 6, 390, "un"],
  ["demo-part-cabo", "Cabo de rede CAT6 2m", "Rede", "Furukawa", "CAT6", "PEC-CAB-CAT6", 30, 18, "un"],
  ["demo-part-mouse", "Mouse USB corporativo", "Periféricos", "Logitech", "M90", "PEC-MOU-USB", 15, 42, "un"]
];

const demoServices = [
  ["demo-service-diagnostic", "SRV-0001", "Diagnóstico técnico", "Atendimento", "medium", 80, "Análise inicial do problema e registro do diagnóstico."],
  ["demo-service-format", "SRV-0002", "Formatação e reinstalação", "Sistemas", "medium", 180, "Reinstalação de sistema operacional e aplicativos básicos."],
  ["demo-service-hardware", "SRV-0003", "Troca de peça", "Hardware", "high", 120, "Substituição física de componente e teste de funcionamento."],
  ["demo-service-network", "SRV-0004", "Correção de rede", "Rede", "high", 150, "Correção de conectividade, ponto de rede ou configuração."],
  ["demo-service-printer", "SRV-0005", "Manutenção de impressora", "Impressoras", "medium", 130, "Limpeza, troca de suprimento ou ajuste de impressão."]
];

const demoProblemTypes = [
  ["demo-problem-power", "Computador não liga", "Computador", "high", "Falha de energia, fonte, placa ou periférico crítico."],
  ["demo-problem-printer", "Impressora não imprime", "Impressora", "medium", "Fila travada, toner, conexão ou driver."],
  ["demo-problem-network", "Internet lenta", "Rede", "medium", "Oscilação de link, Wi-Fi ou ponto físico."],
  ["demo-problem-system", "Sistema travando", "Sistema", "medium", "Lentidão ou travamento de aplicação corporativa."],
  ["demo-problem-piece", "Troca de peça", "Hardware", "high", "Substituição de componente com teste posterior."]
];

const demoOrders = [
  {
    id: "demo-os-001",
    number: "OS-2026-0001",
    title: "Manutenção preventiva do servidor web",
    description: "Verificar alertas de disco e atualizar pacotes do servidor web.",
    status: "in_progress",
    priority: "high",
    category: "Servidor",
    sectorId: "sector-infra",
    sectorName: "Infraestrutura",
    environmentId: "demo-client-orion",
    environmentName: "Orion Saude",
    serviceId: "demo-service-diagnostic",
    serviceCode: "SRV-0001",
    serviceName: "Diagnóstico técnico",
    assetId: "srv-web-01",
    requesterName: "Operação",
    assignedTechnicianName: "Carla Mendes",
    servicePerformed: "Diagnóstico técnico",
    diagnosis: "Disco com alerta preventivo e pacotes pendentes.",
    attendanceNotes: "Janela combinada para execução fora do horário comercial."
  },
  {
    id: "demo-os-002",
    number: "OS-2026-0002",
    title: "Caixa com lentidão no atendimento",
    description: "Máquina do caixa 01 apresenta travamentos durante emissão de cupom.",
    status: "open",
    priority: "medium",
    category: "Desktop",
    sectorId: "sector-support-n1",
    sectorName: "Suporte N1",
    environmentId: "demo-client-alfa",
    environmentName: "Alfa Comercio",
    serviceId: "demo-service-diagnostic",
    serviceCode: "SRV-0001",
    serviceName: "Diagnóstico técnico",
    assetId: "ws-caixa-01",
    requesterName: "Frente de caixa",
    assignedTechnicianName: "Ana Ribeiro",
    servicePerformed: "Diagnóstico técnico",
    diagnosis: "Aguardando avaliação presencial."
  },
  {
    id: "demo-os-003",
    number: "OS-2026-0003",
    title: "Impressora do financeiro falhando",
    description: "Relatórios saem com falhas e manchas.",
    status: "waiting",
    priority: "medium",
    category: "Impressora",
    sectorId: "sector-financeiro",
    sectorName: "Financeiro",
    environmentId: "demo-client-beta",
    environmentName: "Beta Logistica",
    serviceId: "demo-service-printer",
    serviceCode: "SRV-0005",
    serviceName: "Manutenção de impressora",
    assetId: "manual-printer-financeiro",
    requesterName: "Financeiro",
    assignedTechnicianName: "Diego Santos",
    servicePerformed: "Manutenção de impressora",
    diagnosis: "Provável toner no fim e rolete com sujeira.",
    partsUsed: "Toner HP 58A x1"
  },
  {
    id: "demo-os-004",
    number: "OS-2026-0004",
    title: "Notebook da diretoria sem vídeo",
    description: "Usuário relata tela preta ao conectar dockstation.",
    status: "closed",
    priority: "high",
    category: "Notebook",
    sectorId: "sector-diretoria",
    sectorName: "Diretoria",
    environmentId: "demo-client-orion",
    environmentName: "Orion Saude",
    serviceId: "demo-service-network",
    serviceCode: "SRV-0004",
    serviceName: "Correção de rede",
    assetId: "nb-diretoria-01",
    requesterName: "Diretoria",
    assignedTechnicianName: "Bruno Lima",
    servicePerformed: "Correção de rede",
    diagnosis: "Cabo USB-C danificado.",
    attendanceNotes: "Substituído cabo e testado monitor externo.",
    closedAt: "2026-05-20T18:15:00.000Z"
  }
];

export async function seedDemoOperationalData() {
  for (const group of demoGroups) {
    await query(
      `
        INSERT INTO segment_groups (id, name, color, created_by)
        VALUES ($1, $2, $3, 'seed-admin')
        ON CONFLICT (id) DO NOTHING
      `,
      [group.id, group.name, group.color]
    );
  }

  for (const segment of demoSegments) {
    await query(
      `
        INSERT INTO inventory_segments (id, name, color, group_id, created_by)
        VALUES ($1, $2, $3, $4, 'seed-admin')
        ON CONFLICT (id) DO NOTHING
      `,
      [segment.id, segment.name, segment.color, segment.groupId]
    );
  }

  for (const [deviceId, segmentId] of demoAssignments) {
    await query(
      `
        INSERT INTO device_segments (device_id, segment_id, updated_by)
        VALUES ($1, $2, 'seed-admin')
        ON CONFLICT (device_id) DO NOTHING
      `,
      [deviceId, segmentId]
    );
  }

  for (const backup of demoBackups) {
    await query(
      `
        INSERT INTO device_metadata (
          device_id, asset_type, is_backup, backup_status,
          backup_original_segment_id, backup_original_segment_name, updated_by
        )
        VALUES ($1, 'ocs', TRUE, 'available', $2, $3, 'seed-admin')
        ON CONFLICT (device_id)
        DO UPDATE SET asset_type = COALESCE(device_metadata.asset_type, EXCLUDED.asset_type),
                      is_backup = TRUE,
                      backup_status = CASE
                        WHEN device_metadata.backup_status = 'in_use' THEN device_metadata.backup_status
                        ELSE 'available'
                      END,
                      backup_original_segment_id = COALESCE(device_metadata.backup_original_segment_id, EXCLUDED.backup_original_segment_id),
                      backup_original_segment_name = COALESCE(device_metadata.backup_original_segment_name, EXCLUDED.backup_original_segment_name),
                      updated_at = NOW()
      `,
      [backup.id, backup.segmentId, backup.segmentName]
    );
  }

  for (const technician of demoTechnicians) {
    await query(
      `
        INSERT INTO technicians (id, name, email, phone, role, specialty, active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      technician
    );
  }

  for (const client of demoClients) {
    await query(
      `
        INSERT INTO clients (
          id, trade_name, legal_name, document, phone, email, address, contact_name, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      client
    );
  }

  const technicianClientAccess = {
    "demo-tech-ana": ["demo-client-alfa", "demo-client-beta"],
    "demo-tech-bruno": ["demo-client-alfa"],
    "demo-tech-carla": ["demo-client-orion"],
    "demo-tech-diego": ["demo-client-beta", "demo-client-orion"]
  };
  for (const [technicianId, clientIds] of Object.entries(technicianClientAccess)) {
    await query(
      "UPDATE technicians SET allowed_client_ids = $2::jsonb WHERE id = $1",
      [technicianId, JSON.stringify(clientIds)]
    );
  }

  for (const product of demoProducts) {
    await query(
      `
        INSERT INTO products (
          id, name, category, brand, model, internal_code, quantity, unit_price, unit, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      product
    );
  }

  for (const service of demoServices) {
    await query(
      `
        INSERT INTO service_catalog (id, code, name, category, default_priority, default_value, description, notes, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      service
    );
  }

  for (const problemType of demoProblemTypes) {
    await query(
      `
        INSERT INTO problem_types (id, name, category, default_priority, description, active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      problemType
    );
  }

  for (const order of demoOrders) {
    await query(
      `
        INSERT INTO service_orders (
          id, number, title, description, status, priority, category, asset_id,
          sector_id, sector_name, environment_id, environment_name, service_id, service_code, service_name,
          requester_name, assigned_technician_name, service_performed, diagnosis,
          attendance_notes, parts_used, created_by, created_at, updated_at, closed_at
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, $8,
               $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'seed-admin',
               NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hours', $22::timestamptz
        WHERE NOT EXISTS (
          SELECT 1 FROM service_orders WHERE id = $1 OR number = $2
        )
      `,
      [
        order.id,
        order.number,
        order.title,
        order.description,
        order.status,
        order.priority,
        order.category,
        order.assetId,
        order.sectorId,
        order.sectorName,
        order.environmentId,
        order.environmentName,
        order.serviceId,
        order.serviceCode,
        order.serviceName,
        order.requesterName,
        order.assignedTechnicianName,
        order.servicePerformed,
        order.diagnosis,
        order.attendanceNotes || null,
        order.partsUsed || null,
        order.closedAt || null
      ]
    );

    await query(
      `
        UPDATE service_orders
        SET sector_id = $2,
            sector_name = $3,
            environment_id = COALESCE(environment_id, $4),
            environment_name = COALESCE(environment_name, $5),
            service_id = COALESCE(service_id, $6),
            service_code = COALESCE(service_code, $7),
            service_name = COALESCE(service_name, $8),
            updated_at = updated_at
        WHERE id = $1
      `,
      [
        order.id,
        order.sectorId,
        order.sectorName,
        order.environmentId,
        order.environmentName,
        order.serviceId,
        order.serviceCode,
        order.serviceName
      ]
    );

    await query(
      `
        INSERT INTO service_order_history (
          id, service_order_id, event_type, message, user_id, user_name
        )
        VALUES ($1, $2, 'created', $3, 'seed-admin', 'Sistema')
        ON CONFLICT (id) DO NOTHING
      `,
      [`${order.id}-history-created`, order.id, `Ordem de serviço ${order.number} criada para demonstração.`]
    );
  }
}
