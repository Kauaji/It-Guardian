import { query } from "../../database.js";

// Guardado por IS NULL - so grava na primeira vez que a OS recebe algum
// tipo de resposta apos a criacao (tecnico atribuido, status sai do
// inicial, ou atendimento registrado). Chamado explicitamente pelos 3
// pontos certos em serviceOrderService.js, nunca pelo PATCH generico.
export async function setFirstResponseAtIfNeeded(id) {
  await query("UPDATE service_orders SET first_response_at = NOW() WHERE id = $1 AND first_response_at IS NULL", [id]);
}

export async function serviceOrderNumberExists(number) {
  const result = await query("SELECT id FROM service_orders WHERE number = $1 LIMIT 1", [number]);
  return result.rows.length > 0;
}

export async function countServiceOrders() {
  const result = await query("SELECT COUNT(*)::int AS total FROM service_orders");
  return Number(result.rows[0]?.total || 0);
}

export async function insertServiceOrderRow(db, row) {
  const result = await db(
    `
      INSERT INTO service_orders (
        id, number, title, description, status, priority, category, asset_id,
        problem_type, environment_id, environment_name, requester_name, contact_info,
        requester_department, requester_extension, related_asset_text, machine_scope, location,
        source, assigned_technician_name, auto_priority_enabled, notes,
        service_performed, attendance_notes,
        service_value, total_parts_value, total_value, backup_asset_id, sector_id, sector_name,
        service_id, service_code, service_name, preventive_plan_id, created_by, sla_due_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36
      )
      RETURNING *
    `,
    [
      row.id,
      row.number,
      row.title,
      row.description,
      row.status,
      row.priority,
      row.category,
      row.assetId,
      row.problemType,
      row.environmentId,
      row.environmentName,
      row.requesterName,
      row.contactInfo,
      row.requesterDepartment,
      row.requesterExtension,
      row.relatedAssetText,
      row.machineScope,
      row.location,
      row.source,
      row.assignedTechnicianName,
      row.autoPriorityEnabled,
      row.notes,
      row.servicePerformed,
      row.attendanceNotes,
      row.serviceValue,
      row.totalPartsValue,
      row.totalValue,
      row.backupAssetId,
      row.sectorId,
      row.sectorName,
      row.serviceId,
      row.serviceCode,
      row.serviceName,
      row.preventivePlanId,
      row.createdBy,
      row.slaDueAt
    ]
  );
  return result.rows[0];
}

export async function setAssignedTechnicianNames(id, names, db = query) {
  const result = await db("UPDATE service_orders SET assigned_technician_names = $2::jsonb WHERE id = $1 RETURNING *", [
    id,
    JSON.stringify(names)
  ]);
  return result.rows[0] || null;
}

export async function updateServiceOrderRow(id, row) {
  const result = await query(
    `
      UPDATE service_orders
      SET title = $2,
          description = $3,
          status = $4,
          priority = $5,
          category = $6,
          asset_id = $7,
          problem_type = $8,
          environment_id = $9,
          environment_name = $10,
          requester_name = $11,
          contact_info = $12,
          requester_department = $13,
          requester_extension = $14,
          related_asset_text = $15,
          machine_scope = $16,
          location = $17,
          source = $18,
          assigned_technician_name = $19,
          auto_priority_enabled = $20,
          work_notes = $21,
          diagnosis = $22,
          solution = $23,
          parts_used = $24,
          notes = $25,
          closed_at = $26,
          service_value = $27,
          total_parts_value = $28,
          total_value = $29,
          backup_asset_id = $30,
          service_performed = $31,
          attendance_notes = $32,
          sector_id = $33,
          sector_name = $34,
          service_id = $35,
          service_code = $36,
          service_name = $37,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      row.title,
      row.description,
      row.status,
      row.priority,
      row.category,
      row.assetId,
      row.problemType,
      row.environmentId,
      row.environmentName,
      row.requesterName,
      row.contactInfo,
      row.requesterDepartment,
      row.requesterExtension,
      row.relatedAssetText,
      row.machineScope,
      row.location,
      row.source,
      row.assignedTechnicianName,
      row.autoPriorityEnabled,
      row.workNotes,
      row.diagnosis,
      row.solution,
      row.partsUsed,
      row.notes,
      row.closedAt,
      row.serviceValue,
      row.totalPartsValue,
      row.totalValue,
      row.backupAssetId,
      row.servicePerformed,
      row.attendanceNotes,
      row.sectorId,
      row.sectorName,
      row.serviceId,
      row.serviceCode,
      row.serviceName
    ]
  );
  return result.rows[0];
}

export async function updateServiceOrderStatusRow(id, status, finalStatus) {
  const result = await query(
    `
      UPDATE service_orders
      SET status = $2,
          closed_at = CASE WHEN $2 = $3 THEN COALESCE(closed_at, NOW()) ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, finalStatus]
  );
  return result.rows[0];
}

export async function reopenServiceOrderRow({ id, initialStatusId, userId, reason, nextSlaDueAt }) {
  const result = await query(
    `
      UPDATE service_orders
      SET status = $2,
          closed_at = NULL,
          reopened_at = NOW(),
          reopened_by = $3,
          reopen_reason = $4,
          reopen_count = reopen_count + 1,
          sla_due_at = $5,
          sla_breached_at = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, initialStatusId, userId, reason, nextSlaDueAt]
  );
  return result.rows[0];
}

export async function deleteServiceOrderRow(id) {
  await query("DELETE FROM service_orders WHERE id = $1", [id]);
}

export async function listOrdersWithAutoPriority(finalStatusId) {
  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE auto_priority_enabled = true
        AND status != $1
    `,
    [finalStatusId]
  );
  return result.rows;
}

export async function updateAutoPriorityRow(id, priority, slaDueAt) {
  const result = await query(
    `
      UPDATE service_orders
      SET priority = $2, sla_due_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, priority, slaDueAt]
  );
  return result.rows[0] || null;
}

export async function listOrdersWithExpiredSla(finalStatusId) {
  const result = await query(
    `
      SELECT *
      FROM service_orders
      WHERE sla_due_at < NOW()
        AND sla_breached_at IS NULL
        AND status != $1
    `,
    [finalStatusId]
  );
  return result.rows;
}

export async function markSlaBreachedRow(id) {
  const result = await query(
    `
      UPDATE service_orders
      SET sla_breached_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND sla_breached_at IS NULL
      RETURNING *
    `,
    [id]
  );
  return result.rows[0] || null;
}
