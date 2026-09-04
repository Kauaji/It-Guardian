import { randomUUID } from "node:crypto";
import { query } from "../database.js";

function notFound() {
  const error = new Error("Agendamento não encontrado.");
  error.statusCode = 404;
  return error;
}

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    status: row.status,
    priority: row.priority,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    serviceOrderId: row.service_order_id,
    serviceOrderNumber: row.service_order_number,
    serviceOrderTitle: row.service_order_title,
    assetId: row.asset_id,
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    technicianEmail: row.technician_email,
    segmentId: row.segment_id,
    segmentName: row.segment_name,
    groupId: row.group_id,
    groupName: row.group_name,
    environmentName: row.environment_name,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    metadata: row.metadata_json || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const selectEvent = `
  SELECT ce.*, so.number AS service_order_number, so.title AS service_order_title,
    t.name AS technician_name, t.email AS technician_email, s.name AS segment_name, sg.name AS group_name,
    u.name AS created_by_name
  FROM calendar_events ce
  LEFT JOIN service_orders so ON so.id = ce.service_order_id
  LEFT JOIN technicians t ON t.id = ce.technician_id
  LEFT JOIN inventory_segments s ON s.id = ce.segment_id
  LEFT JOIN segment_groups sg ON sg.id = ce.group_id
  LEFT JOIN users u ON u.id = ce.created_by
`;

export async function assertCalendarReferences(payload) {
  const checks = [
    ["serviceOrderId", "service_orders", "OS vinculada"],
    ["technicianId", "technicians", "Técnico"],
    ["segmentId", "inventory_segments", "Segmento"],
    ["groupId", "segment_groups", "Grupo"]
  ];
  for (const [field, table, label] of checks) {
    if (!payload[field]) continue;
    const result = await query(`SELECT id FROM ${table} WHERE id = $1`, [payload[field]]);
    if (!result.rowCount) {
      const error = new Error(`${label} não encontrado.`);
      error.statusCode = 400;
      throw error;
    }
  }
}

export async function listCalendarEvents(filters, user, canViewAll) {
  await query(`
    UPDATE calendar_events
    SET status = 'completed', updated_at = NOW()
    WHERE status IN ('scheduled', 'in_progress')
      AND all_day = FALSE
      AND end_at IS NOT NULL
      AND end_at <= NOW()
  `);
  const where = ["ce.start_at < $2", "COALESCE(ce.end_at, ce.start_at) >= $1"];
  const params = [filters.startDate, filters.endDate];
  const fields = { technicianId: "ce.technician_id", eventType: "ce.event_type", status: "ce.status", priority: "ce.priority", serviceOrderId: "ce.service_order_id", assetId: "ce.asset_id", segmentId: "ce.segment_id", groupId: "ce.group_id" };
  for (const [key, column] of Object.entries(fields)) {
    if (!filters[key]) continue;
    params.push(filters[key]);
    where.push(`${column} = $${params.length}`);
  }
  if (!canViewAll) {
    params.push(user.id, user.email || "", user.name || "");
    where.push(`(ce.created_by = $${params.length - 2} OR ce.technician_id IN (SELECT id FROM technicians WHERE LOWER(email) = LOWER($${params.length - 1}) OR LOWER(name) = LOWER($${params.length})))`);
  }
  const result = await query(`${selectEvent} WHERE ${where.join(" AND ")} ORDER BY ce.start_at ASC, ce.title ASC`, params);
  return result.rows.map(mapEvent);
}

export async function getCalendarEvent(id) {
  const result = await query(`${selectEvent} WHERE ce.id = $1`, [id]);
  if (!result.rowCount) throw notFound();
  return mapEvent(result.rows[0]);
}

export async function createCalendarEvent(payload, user) {
  const id = randomUUID();
  await query(`
    INSERT INTO calendar_events (
      id, title, description, event_type, status, priority, start_at, end_at, all_day,
      service_order_id, asset_id, technician_id, segment_id, group_id, environment_name,
      created_by, updated_by, metadata_json
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17)
  `, [id, payload.title, payload.description || "", payload.eventType, payload.status, payload.priority, payload.startAt, payload.endAt, payload.allDay, payload.serviceOrderId, payload.assetId, payload.technicianId, payload.segmentId, payload.groupId, payload.environmentName, user.id, JSON.stringify(payload.metadata || {})]);
  return getCalendarEvent(id);
}

export async function updateCalendarEvent(id, payload, user) {
  const current = await getCalendarEvent(id);
  const next = { ...current, ...payload };
  await query(`
    UPDATE calendar_events SET title=$2, description=$3, event_type=$4, status=$5, priority=$6,
      start_at=$7, end_at=$8, all_day=$9, service_order_id=$10, asset_id=$11,
      technician_id=$12, segment_id=$13, group_id=$14, environment_name=$15,
      updated_by=$16, metadata_json=$17, updated_at=NOW()
    WHERE id=$1
  `, [id, next.title, next.description || "", next.eventType, next.status, next.priority, next.startAt, next.endAt, next.allDay, next.serviceOrderId, next.assetId, next.technicianId, next.segmentId, next.groupId, next.environmentName, user.id, JSON.stringify(next.metadata || {})]);
  return getCalendarEvent(id);
}

export async function cancelCalendarEvent(id, reason, user) {
  const result = await query(`UPDATE calendar_events SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2, updated_by=$3, updated_at=NOW() WHERE id=$1 RETURNING id`, [id, String(reason || "").trim().slice(0, 1000) || null, user.id]);
  if (!result.rowCount) throw notFound();
  return getCalendarEvent(id);
}

export async function deleteCalendarEvent(id) {
  const result = await query("DELETE FROM calendar_events WHERE id=$1 RETURNING id", [id]);
  if (!result.rowCount) throw notFound();
  return { id };
}
