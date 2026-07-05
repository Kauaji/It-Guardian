import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { findDeviceMetadata, updateDeviceBackup } from "./deviceMetadataRepository.js";
import {
  DEFAULT_SEGMENT_ID,
  DEFAULT_SEGMENT_NAME,
  updateDeviceSegment
} from "./segmentRepository.js";
import { addServiceOrderHistory } from "./serviceOrderRepository.js";

function normalizeReservedName(name = "") {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function userLabel(user) {
  return { id: user.id || null, name: user.name || "Sistema"
  };
}

function fromMaintenanceRow(row) {
  if (!row) return null;
  return { id: row.id, assetId: row.asset_id, serviceOrderId: row.service_order_id, status: row.status, originalSegmentId: row.original_segment_id, originalSegmentName: row.original_segment_name, maintenanceSegmentId: row.maintenance_segment_id, startedAt: row.started_at, finishedAt: row.finished_at, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, origin: { segmentId: row.original_segment_id, segmentName: row.original_segment_name
    }
  };
}

function fromBackupAssignmentRow(row) {
  if (!row) return null;
  return { id: row.id, backupAssetId: row.backup_asset_id, serviceOrderId: row.service_order_id, originalAssetId: row.original_asset_id, status: row.status, assignedAt: row.assigned_at, releasedAt: row.released_at, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

async function findServiceOrderRaw(id) {
  const result = await query(
    `
      SELECT id, number, asset_id, backup_asset_id, status, closed_at
      FROM service_orders
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function setServiceOrderBackupAsset(serviceOrderId, backupAssetId) {
  await query(
    `
      UPDATE service_orders
      SET backup_asset_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [serviceOrderId, backupAssetId || null]
  );
}

async function findSegmentByIdRaw(id) {
  if (!id) return null;
  const result = await query(
    `
      SELECT id, name, color, group_id, is_default
      FROM inventory_segments
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getCurrentDeviceSegment(assetId) {
  const result = await query(
    `
      SELECT segments.id,
             segments.name,
             segments.group_id
      FROM device_segments
      INNER JOIN inventory_segments segments ON segments.id = device_segments.segment_id
      WHERE device_segments.device_id = $1
      LIMIT 1
    `,
    [assetId]
  );

  if (result.rows[0]) {
    return { id: result.rows[0].id, name: result.rows[0].name, groupId: result.rows[0].group_id || null
    };
  }

  return { id: DEFAULT_SEGMENT_ID, name: DEFAULT_SEGMENT_NAME, groupId: null
  };
}

async function ensureMaintenanceSegment(groupId = null, userId = null) {
  const result = await query(
    `
      SELECT id, name, color, group_id
      FROM inventory_segments
      WHERE COALESCE(group_id, '') = COALESCE($1, '')
      ORDER BY created_at ASC
    `,
    [groupId || null]
  );
  const existing = result.rows.find((row) => normalizeReservedName(row.name) === "manutencao");

  if (existing) {
    return { id: existing.id, name: existing.name, groupId: existing.group_id || null
    };
  }

  const insert = await query(
    `
      INSERT INTO inventory_segments (id, name, color, group_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, color, group_id
    `,
    [randomUUID(), "Manutenção", "#f59e0b", groupId || null, userId]
  );

  return { id: insert.rows[0].id, name: insert.rows[0].name, groupId: insert.rows[0].group_id || null
  };
}

export async function listActiveMaintenanceRecordsMap() {
  const result = await query(
    `
      SELECT *
      FROM maintenance_records
      WHERE status = 'active'
    `
  );

  return new Map(result.rows.map((row) => [row.asset_id, fromMaintenanceRow(row)]));
}

export async function findActiveMaintenanceByAsset(assetId) {
  const result = await query(
    `
      SELECT *
      FROM maintenance_records
      WHERE asset_id = $1
        AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [assetId]
  );

  return fromMaintenanceRow(result.rows[0]);
}

export async function findActiveMaintenanceByServiceOrder(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM maintenance_records
      WHERE service_order_id = $1
        AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [serviceOrderId]
  );

  return fromMaintenanceRow(result.rows[0]);
}

export async function hasActiveMaintenanceForServiceOrder(serviceOrderId) {
  return Boolean(await findActiveMaintenanceByServiceOrder(serviceOrderId));
}

export async function startMaintenanceForAsset({
  assetId,
  serviceOrderId = null,
  notes = null,
  user
}) {
  if (!assetId) {
    const error = new Error("assetId e obrigatorio.");
    error.statusCode = 400;
    throw error;
  }

  const active = await findActiveMaintenanceByAsset(assetId);
  if (active) {
    const error = new Error("Esta máquina já está em manutenção.");
    error.statusCode = 409;
    throw error;
  }

  const currentSegment = await getCurrentDeviceSegment(assetId);
  if (normalizeReservedName(currentSegment.name) === "manutencao") {
    const error = new Error("Esta máquina já está no segmento de manutenção.");
    error.statusCode = 409;
    throw error;
  }

  const maintenanceSegment = await ensureMaintenanceSegment(currentSegment.groupId, user.id || null);
  await updateDeviceSegment({ deviceId: assetId, segmentId: maintenanceSegment.id, userId: user.id || null
  });

  const result = await query(
    `
      INSERT INTO maintenance_records (
        id, asset_id, service_order_id, status, original_segment_id, original_segment_name,
        maintenance_segment_id, started_by, notes
      )
      VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      randomUUID(),
      assetId,
      serviceOrderId || null,
      currentSegment.id,
      currentSegment.name,
      maintenanceSegment.id,
      user.id || null,
      notes
    ]
  );
  const record = fromMaintenanceRow(result.rows[0]);
  const userInfo = userLabel(user);

  await addAssetHistory({
    assetId, eventType: "maintenance", message: serviceOrderId
      ?
       "Máquina colocada em manutenção por Ordem de Serviço."
      : "Máquina colocada em manutenção.", oldValue: currentSegment.name, newValue: maintenanceSegment.name, userId: userInfo.id, userName: userInfo.name
  });

  if (serviceOrderId) {
    await addServiceOrderHistory({
      serviceOrderId, eventType: "maintenance", message: "Máquina vinculada e colocada em manutenção.", oldValue: currentSegment.name, newValue: maintenanceSegment.name,
      user
    });
  }

  return record;
}

export async function finishMaintenanceForAsset({
  assetId,
  serviceOrderId = null,
  notes = null,
  user,
  allowMissing = false
}) {
  const active = assetId
    ? await findActiveMaintenanceByAsset(assetId)
    : serviceOrderId
      ? await findActiveMaintenanceByServiceOrder(serviceOrderId)
      : null;

  if (!active) {
    if (allowMissing) return null;
    const error = new Error("Não existe manutenção ativa para esta máquina.");
    error.statusCode = 404;
    throw error;
  }

  const targetSegment =
    (await findSegmentByIdRaw(active.originalSegmentId)) ||
    (await findSegmentByIdRaw(DEFAULT_SEGMENT_ID));

  if (!targetSegment.id) {
    const error = new Error("Não foi possível localizar o segmento de retorno.");
    error.statusCode = 409;
    throw error;
  }

  await updateDeviceSegment({ deviceId: active.assetId, segmentId: targetSegment.id, userId: user.id || null
  });

  const result = await query(
    `
      UPDATE maintenance_records
      SET status = 'finished',
          finished_at = NOW(),
          finished_by = $2,
          notes = COALESCE($3, notes),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [active.id, user.id || null, notes]
  );
  const record = fromMaintenanceRow(result.rows[0]);
  const userInfo = userLabel(user);
  const fallbackUsed = targetSegment.id !== active.originalSegmentId;

  await addAssetHistory({ assetId: active.assetId, eventType: "maintenance", message: fallbackUsed
      ?
       "Máquina retirada da manutenção; segmento original indisponível, movida para Não organizadas."
      : "Máquina retirada da manutenção.", oldValue: "Manutenção", newValue: targetSegment.name, userId: userInfo.id, userName: userInfo.name
  });

  const orderId = serviceOrderId || active.serviceOrderId;
  if (orderId) {
    await addServiceOrderHistory({ serviceOrderId: orderId, eventType: "maintenance", message: fallbackUsed
        ?
         "Máquina saiu da manutenção, mas o segmento original não existe mais."
        : "Máquina saiu da manutenção.", oldValue: "Manutenção", newValue: targetSegment.name,
      user
    });
  }

  return record;
}

export async function hasActiveBackupAssignmentForServiceOrder(serviceOrderId) {
  const result = await query(
    `
      SELECT id
      FROM backup_assignments
      WHERE service_order_id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [serviceOrderId]
  );

  return Boolean(result.rows[0]);
}

async function findActiveBackupAssignmentByOrder(serviceOrderId) {
  const result = await query(
    `
      SELECT *
      FROM backup_assignments
      WHERE service_order_id = $1
        AND status = 'active'
      ORDER BY assigned_at DESC
      LIMIT 1
    `,
    [serviceOrderId]
  );

  return fromBackupAssignmentRow(result.rows[0]);
}

async function findActiveBackupAssignmentByAsset(backupAssetId) {
  const result = await query(
    `
      SELECT *
      FROM backup_assignments
      WHERE backup_asset_id = $1
        AND status = 'active'
      ORDER BY assigned_at DESC
      LIMIT 1
    `,
    [backupAssetId]
  );

  return fromBackupAssignmentRow(result.rows[0]);
}

export async function assignBackupToServiceOrder({ serviceOrderId, backupAssetId, user }) {
  const order = await findServiceOrderRaw(serviceOrderId);
  if (!order) {
    const error = new Error("Ordem de Serviço não encontrada.");
    error.statusCode = 404;
    throw error;
  }

  if (!order.asset_id) {
    const error = new Error("Vincule a máquina principal antes de selecionar um Backup.");
    error.statusCode = 400;
    throw error;
  }

  if (order.backup_asset_id) {
    const error = new Error("Esta OS já possui uma máquina Backup vinculada.");
    error.statusCode = 409;
    throw error;
  }

  const metadata = await findDeviceMetadata(backupAssetId);
  if (!metadata.isBackup) {
    const error = new Error("Selecione uma máquina marcada como Backup.");
    error.statusCode = 400;
    throw error;
  }

  if (metadata.backupStatus === "in_use" || await findActiveBackupAssignmentByAsset(backupAssetId)) {
    const error = new Error("Esta máquina Backup já está em uso em outra OS.");
    error.statusCode = 409;
    throw error;
  }

  let maintenance = await findActiveMaintenanceByAsset(order.asset_id);
  if (!maintenance) {
    try {
      maintenance = await startMaintenanceForAsset({ assetId: order.asset_id,
        serviceOrderId,
        user
      });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      maintenance = await findActiveMaintenanceByAsset(order.asset_id);
    }
  }

  const backupCurrentSegment = await getCurrentDeviceSegment(backupAssetId);
  const targetSegment =
    (await findSegmentByIdRaw(maintenance.originalSegmentId)) ||
    (await findSegmentByIdRaw(DEFAULT_SEGMENT_ID));

  if (!targetSegment.id) {
    const error = new Error("Não foi possível localizar o segmento de destino do Backup.");
    error.statusCode = 409;
    throw error;
  }

  await updateDeviceSegment({ deviceId: backupAssetId, segmentId: targetSegment.id, userId: user.id || null
  });
  await updateDeviceBackup({ deviceId: backupAssetId, assetType: metadata.assetType || "desktop", isBackup: true, backupStatus: "in_use", backupOrderId: serviceOrderId, backupOriginalSegmentId: backupCurrentSegment.id, backupOriginalSegmentName: backupCurrentSegment.name, userId: user.id || null
  });
  await setServiceOrderBackupAsset(serviceOrderId, backupAssetId);

  const insert = await query(
    `
      INSERT INTO backup_assignments (
        id, backup_asset_id, service_order_id, original_asset_id, status, assigned_by
      )
      VALUES ($1, $2, $3, $4, 'active', $5)
      RETURNING *
    `,
    [randomUUID(), backupAssetId, serviceOrderId, order.asset_id, user.id || null]
  );
  const assignment = fromBackupAssignmentRow(insert.rows[0]);
  const userInfo = userLabel(user);

  await addServiceOrderHistory({
    serviceOrderId, eventType: "backup", message: "Backup selecionado e movido para o local da máquina principal.", oldValue: "", newValue: backupAssetId,
    user
  });
  await addAssetHistory({ assetId: order.asset_id, eventType: "backup", message: `Substituída temporariamente por máquina Backup na OS #${order.number}.`, oldValue: order.asset_id, newValue: backupAssetId, userId: userInfo.id, userName: userInfo.name
  });
  await addAssetHistory({ assetId: backupAssetId, eventType: "backup", message: `Usada como substituta na OS #${order.number}.`, oldValue: backupCurrentSegment.name, newValue: targetSegment.name, userId: userInfo.id, userName: userInfo.name
  });

  return assignment;
}

export async function releaseBackupFromServiceOrder({ serviceOrderId, user, allowMissing = false }) {
  const order = await findServiceOrderRaw(serviceOrderId);
  const active = await findActiveBackupAssignmentByOrder(serviceOrderId);
  const backupAssetId = active.backupAssetId || order.backup_asset_id;

  if (!backupAssetId) {
    if (allowMissing) return null;
    const error = new Error("Esta OS não possui Backup ativo.");
    error.statusCode = 404;
    throw error;
  }

  const metadata = await findDeviceMetadata(backupAssetId);
  const targetSegment =
    (await findSegmentByIdRaw(metadata.backupOriginalSegmentId)) ||
    (await findSegmentByIdRaw(DEFAULT_SEGMENT_ID));

  if (!targetSegment.id) {
    const error = new Error("Não foi possível localizar o retorno do Backup.");
    error.statusCode = 409;
    throw error;
  }

  await updateDeviceSegment({ deviceId: backupAssetId, segmentId: targetSegment.id, userId: user.id || null
  });
  await updateDeviceBackup({ deviceId: backupAssetId, assetType: metadata.assetType || "desktop", isBackup: true, backupStatus: "available", backupOrderId: null, backupOriginalSegmentId: targetSegment.id, backupOriginalSegmentName: targetSegment.name, userId: user.id || null
  });
  await setServiceOrderBackupAsset(serviceOrderId, null);

  if (active) {
    await query(
      `
        UPDATE backup_assignments
        SET status = 'released',
            released_at = NOW(),
            released_by = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [active.id, user.id || null]
    );
  }

  const userInfo = userLabel(user);
  await addServiceOrderHistory({
    serviceOrderId, eventType: "backup", message: "Máquina Backup devolvida para a área Backup.", oldValue: backupAssetId, newValue: "Disponivel",
    user
  });
  await addAssetHistory({ assetId: backupAssetId, eventType: "backup", message: order.number ? `Devolvida pela OS #${order.number}.`: "Backup liberado.", oldValue: "Em uso", newValue: targetSegment.name, userId: userInfo.id, userName: userInfo.name
  });
return active || { backupAssetId, serviceOrderId, status: "released" };
}
