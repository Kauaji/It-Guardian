import { query } from "../../database.js";
import { demoOrders } from "./demoServiceOrderData.js";

async function insertDemoOrderIfMissing(order) {
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
}

// Corrige setor/cliente/servico de OS de demonstracao que ja existiam sem esses dados.
async function backfillDemoOrderReferences(order) {
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
}

async function insertDemoOrderCreatedHistory(order) {
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

export async function seedDemoServiceOrders() {
  for (const order of demoOrders) {
    await insertDemoOrderIfMissing(order);
    await backfillDemoOrderReferences(order);
    await insertDemoOrderCreatedHistory(order);
  }
}
