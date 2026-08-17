import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { markDeviceRemoved, updateDeviceBackup, updateDeviceType } from "../repositories/deviceMetadataRepository.js";
import { createManualAsset, deleteManualAsset, refreshManualAssetPing, updateManualAsset } from "../repositories/manualAssetRepository.js";
import { updateDeviceSegment } from "../repositories/segmentRepository.js";
import { updateAgentAssetAlias } from "../repositories/agentRepository.js";
import { getDashboardSummary, getDeviceDetails, listDevices } from "./monitoringService.js";
import { broadcastSnapshot } from "./realtimeService.js";
import { badRequest, notFoundError } from "../lib/errors.js";

const assetTypes = new Set([
  "server",
  "desktop",
  "notebook",
  "printer",
  "router",
  "switch",
  "access_point",
  "camera_ip",
  "nas",
  "other"
]);

const backupStatuses = new Set(["available", "in_use"]);
const deviceNotFoundMessage = "Device not found";

function validateManualAsset(payload) {
  const required = ["name", "type", "brand", "model", "assetTag", "ip"];
  const missing = required.filter((field) => !payload[field]?.trim?.());

  if (missing.length) {
    throw badRequest(`Campos obrigatorios ausentes: ${missing.join(", ")}`);
  }

  if (!assetTypes.has(payload.type)) {
    throw badRequest("Tipo de ativo invalido");
  }
}

function notifySnapshot(context) {
  broadcastSnapshot().catch((error) => {
    console.error(`Realtime broadcast failed after ${context}`, error);
  });
}

async function requireDevice(id) {
  const device = await getDeviceDetails(id);
  if (!device) throw notFoundError(deviceNotFoundMessage);
  return device;
}

export async function listAllDevices(search, status) {
  const devices = await listDevices({ search: search || "", status: status || "" });
  const summary = await getDashboardSummary();
  return { summary, devices };
}

export async function getDeviceDetailsAndLog(id, user) {
  const device = await requireDevice(id);

  await addLog({
    type: "device_view",
    message: `Device details viewed: ${device.name}`,
    userId: user.id,
    meta: { deviceId: device.id }
  });

  return device;
}

export async function getPublicDeviceDetails(id) {
  return requireDevice(id);
}

export async function createManualDevice(payload, user) {
  validateManualAsset(payload);

  const asset = await createManualAsset({ payload, user });
  const device = await getDeviceDetails(asset.id);

  await addLog({
    type: "manual_asset_create",
    message: `Manual network asset created: ${asset.name}`,
    userId: user.id,
    meta: { deviceId: asset.id }
  });

  notifySnapshot("manual asset create");
  return device;
}

export async function updateManualDevice(id, payload, user) {
  const asset = await updateManualAsset({ id, payload, user });
  if (!asset) throw notFoundError("Manual asset not found");

  await addLog({
    type: "manual_asset_update",
    message: `Manual network asset updated: ${asset.name}`,
    userId: user.id,
    meta: { deviceId: asset.id }
  });

  notifySnapshot("manual asset update");
  return getDeviceDetails(asset.id);
}

export async function refreshDevicePing(id, user) {
  const response = await refreshManualAssetPing({ id, user });
  if (!response) throw notFoundError("Manual asset not found");

  await addLog({
    type: "manual_asset_ping",
    message: `Manual network asset ping checked: ${response.asset.name}`,
    userId: user.id,
    meta: { deviceId: response.asset.id, status: response.asset.status }
  });

  notifySnapshot("manual asset ping");
  return { device: await getDeviceDetails(response.asset.id), ping: response.ping };
}

export async function changeType(id, assetType, user) {
  const device = await requireDevice(id);

  if (!assetTypes.has(assetType)) {
    throw badRequest("Tipo de ativo invalido");
  }

  if (device.source === "manual") {
    await updateManualAsset({ id: device.id, payload: { type: assetType }, user });
  } else {
    await updateDeviceType({ deviceId: device.id, assetType, userId: user.id });
    await addAssetHistory({
      assetId: device.id,
      eventType: "type",
      message: "Tipo do aparelho alterado",
      oldValue: device.assetType,
      newValue: assetType,
      userId: user.id,
      userName: user.name
    });
  }

  await addLog({
    type: "device_type_update",
    message: `Device type updated: ${device.name}`,
    userId: user.id,
    meta: { deviceId: device.id, oldType: device.assetType, newType: assetType }
  });

  notifySnapshot("device type update");
  return getDeviceDetails(device.id);
}

export async function changeAlias(id, rawAlias, user) {
  const device = await requireDevice(id);
  if (device.source !== "agent") {
    throw badRequest("Nome fantasia persistente disponivel para ativos do agente.");
  }

  const alias = String(rawAlias || "").trim();
  if (alias.length > 180) {
    throw badRequest("Nome fantasia excede 180 caracteres.");
  }

  await updateAgentAssetAlias({ assetId: device.id, alias });
  await addAssetHistory({
    assetId: device.id,
    eventType: "alias",
    message: alias ? "Nome fantasia atualizado" : "Nome fantasia removido",
    oldValue: device.name,
    newValue: alias || device.agent?.hostname || device.name,
    userId: user.id,
    userName: user.name
  });

  notifySnapshot("device alias update");
  return getDeviceDetails(device.id);
}

export async function moveDeviceToSegment(id, { segmentId, reason }, user) {
  const device = await requireDevice(id);

  if (!segmentId) {
    throw badRequest("segmentId is required");
  }

  const assignment = await updateDeviceSegment({ deviceId: id, segmentId, userId: user.id });

  const maintenanceMessage =
    reason === "maintenance"
      ? "Maquina colocada em manutencao"
      : reason === "maintenance_exit"
        ? "Maquina retirada da manutencao"
        : reason === "backup_in_use"
          ? "Maquina Backup movida temporariamente"
          : reason === "backup_return"
            ? "Maquina Backup devolvida para a area de Backup"
            : "Mudanca de segmento";

  await addAssetHistory({
    assetId: device.id,
    eventType:
      reason === "maintenance" || reason === "maintenance_exit"
        ? "maintenance"
        : reason === "backup_in_use" || reason === "backup_return"
          ? "backup"
          : "segment",
    message: maintenanceMessage,
    oldValue: device.segmentName,
    newValue: assignment.segmentName,
    userId: user.id,
    userName: user.name
  });

  await addLog({
    type: "device_segment_update",
    message: `Device moved to segment: ${device.name}`,
    userId: user.id,
    meta: { deviceId: device.id, segmentId }
  });

  notifySnapshot("device segment update");
  const updatedDevice = await getDeviceDetails(id);
  return { assignment, device: updatedDevice };
}

export async function changeBackupStatus(id, body, user) {
  const device = await requireDevice(id);

  const isBackup = Boolean(body.isBackup);
  const backupStatus = body.status || body.backupStatus || "available";

  if (!backupStatuses.has(backupStatus)) {
    throw badRequest("Status de Backup invalido.");
  }

  await updateDeviceBackup({
    deviceId: device.id,
    assetType: device.assetType || "desktop",
    isBackup,
    backupStatus,
    backupOrderId: body.serviceOrderId || body.backupOrderId || null,
    backupOriginalSegmentId: body.originalSegmentId || body.backupOriginalSegmentId || null,
    backupOriginalSegmentName: body.originalSegmentName || body.backupOriginalSegmentName || null,
    userId: user.id
  });

  const message = !isBackup
    ? "Maquina removida da area de Backup"
    : backupStatus === "in_use"
      ? "Maquina Backup usada temporariamente"
      : "Maquina marcada como Backup";

  await addAssetHistory({
    assetId: device.id,
    eventType: "backup",
    message,
    oldValue: device.isBackup ? `${device.backupStatus || "available"}` : "normal",
    newValue: isBackup ? backupStatus : "normal",
    userId: user.id,
    userName: user.name
  });

  await addLog({
    type: "device_backup_update",
    message: `Device backup status updated: ${device.name}`,
    userId: user.id,
    meta: { deviceId: device.id, isBackup, backupStatus }
  });

  notifySnapshot("device backup update");
  return getDeviceDetails(device.id);
}

export async function removeDeviceById(id, user) {
  const device = await requireDevice(id);

  if (device.source === "manual") {
    await deleteManualAsset({ id: device.id, user });
  } else {
    await addAssetHistory({
      assetId: device.id,
      eventType: "removed",
      message: "Maquina removida do inventario",
      oldValue: device.segmentName,
      newValue: "Removida",
      userId: user.id,
      userName: user.name
    });
    await markDeviceRemoved({
      deviceId: device.id,
      assetType: device.assetType || "desktop",
      userId: user.id
    });
  }

  await addLog({
    type: "device_remove",
    message: `Device removed from inventory: ${device.name}`,
    userId: user.id,
    meta: { deviceId: device.id, source: device.source }
  });

  notifySnapshot("device remove");
  return { removed: true, deviceId: device.id };
}
