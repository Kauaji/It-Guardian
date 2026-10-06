import { generalSector } from "../../domain/serviceOrders/serviceOrderSector.js";
import { calculateServiceOrderSla } from "../../domain/serviceOrders/serviceOrderSla.js";
import { parseJsonArray } from "../../domain/serviceOrders/serviceOrderText.js";

export function fromItemRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: Number(row.quantity || 0),
    unitPrice: Number(row.unit_price || 0),
    subtotal: Number(row.subtotal || 0),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function fromOrderRow(row, history = [], items = [], settings = null, feedback = null) {
  const order = {
    id: row.id,
    isDemo: String(row.id || "").startsWith("demo-os-"),
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    problemType: row.problem_type,
    assetId: row.asset_id,
    backupAssetId: row.backup_asset_id,
    environmentId: row.environment_id,
    environmentName: row.environment_name,
    sectorId: row.sector_id || generalSector.id,
    sectorName: row.sector_name || generalSector.name,
    serviceId: row.service_id,
    serviceCode: row.service_code,
    serviceName: row.service_name,
    preventivePlanId: row.preventive_plan_id,
    requesterName: row.requester_name,
    contactInfo: row.contact_info,
    requesterDepartment: row.requester_department,
    requesterExtension: row.requester_extension,
    relatedAssetText: row.related_asset_text,
    machineScope: row.machine_scope,
    location: row.location,
    source: row.source,
    assignedTechnicianName: row.assigned_technician_name,
    assignedTechnicianNames: (() => {
      const names = parseJsonArray(row.assigned_technician_names);
      return names.length ? names : row.assigned_technician_name ? [row.assigned_technician_name] : [];
    })(),
    autoPriorityEnabled: row.auto_priority_enabled,
    workNotes: row.work_notes,
    diagnosis: row.diagnosis,
    solution: row.solution,
    servicePerformed: row.service_performed,
    attendanceNotes: row.attendance_notes,
    partsUsed: row.parts_used,
    serviceValue: Number(row.service_value || 0),
    totalPartsValue: Number(row.total_parts_value || 0),
    totalValue: Number(row.total_value || 0),
    items,
    serviceItems: items,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    slaDueAt: row.sla_due_at,
    firstResponseAt: row.first_response_at,
    slaBreachedAt: row.sla_breached_at,
    reopenedAt: row.reopened_at,
    reopenedBy: row.reopened_by,
    reopenReason: row.reopen_reason,
    reopenCount: Number(row.reopen_count || 0),
    feedback,
    history
  };
  if (settings) order.sla = calculateServiceOrderSla(order, settings);
  return order;
}

export function fromHistoryRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    eventType: row.event_type,
    message: row.message,
    oldValue: row.old_value,
    newValue: row.new_value,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at
  };
}

export function fromFeedbackRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    rating: Number(row.rating),
    comment: row.comment,
    submittedByName: row.submitted_by_name,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    source: row.source
  };
}

export function fromAttachmentRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    storageKey: row.storage_key,
    category: row.category,
    description: row.description,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at
  };
}
