import { addLog } from "../repositories/logRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { markDeviceRemoved, updateDeviceType } from "../repositories/deviceMetadataRepository.js";
import { createManualAsset, deleteManualAsset, refreshManualAssetPing, updateManualAsset } from "../repositories/manualAssetRepository.js";
import { updateDeviceSegment } from "../repositories/segmentRepository.js";
import { getDashboardSummary, getDeviceDetails, listDevices } from "../services/monitoringService.js";
import { broadcastSnapshot } from "../services/realtimeService.js";

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

function validateManualAsset(payload) {
  const required = ["name", "type", "brand", "model", "assetTag", "ip"];
  const missing = required.filter((field) => !payload[field]?.trim?.());

  if (missing.length) {
    const error = new Error(`Campos obrigatorios ausentes: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (!assetTypes.has(payload.type)) {
    const error = new Error("Tipo de ativo invalido");
    error.statusCode = 400;
    throw error;
  }
}

export async function list(req, res, next) {
  try {
    const devices = await listDevices({
      search: req.query.search || "",
      status: req.query.status || ""
    });
    const summary = await getDashboardSummary();

    res.json({ summary, devices });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const device = await getDeviceDetails(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    await addLog({
      type: "device_view",
      message: `Device details viewed: ${device.name}`,
      userId: req.user.id,
      meta: { deviceId: device.id }
    });

    return res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function publicDetails(req, res, next) {
  try {
    const device = await getDeviceDetails(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    return res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function createManual(req, res, next) {
  try {
    validateManualAsset(req.body);

    const asset = await createManualAsset({ payload: req.body, user: req.user });
    const device = await getDeviceDetails(asset.id);

    await addLog({
      type: "manual_asset_create",
      message: `Manual network asset created: ${asset.name}`,
      userId: req.user.id,
      meta: { deviceId: asset.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after manual asset create", error);
    });

    return res.status(201).json({ device });
  } catch (error) {
    next(error);
  }
}

export async function updateManual(req, res, next) {
  try {
    const asset = await updateManualAsset({ id: req.params.id, payload: req.body, user: req.user });

    if (!asset) {
      return res.status(404).json({ message: "Manual asset not found" });
    }

    await addLog({
      type: "manual_asset_update",
      message: `Manual network asset updated: ${asset.name}`,
      userId: req.user.id,
      meta: { deviceId: asset.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after manual asset update", error);
    });

    return res.json({ device: await getDeviceDetails(asset.id) });
  } catch (error) {
    next(error);
  }
}

export async function refreshPing(req, res, next) {
  try {
    const response = await refreshManualAssetPing({ id: req.params.id, user: req.user });

    if (!response) {
      return res.status(404).json({ message: "Manual asset not found" });
    }

    await addLog({
      type: "manual_asset_ping",
      message: `Manual network asset ping checked: ${response.asset.name}`,
      userId: req.user.id,
      meta: { deviceId: response.asset.id, status: response.asset.status }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after manual asset ping", error);
    });

    return res.json({ device: await getDeviceDetails(response.asset.id), ping: response.ping });
  } catch (error) {
    next(error);
  }
}

export async function changeDeviceType(req, res, next) {
  try {
    const device = await getDeviceDetails(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    const assetType = req.body.assetType;

    if (!assetTypes.has(assetType)) {
      return res.status(400).json({ message: "Tipo de ativo invalido" });
    }

    if (device.source === "manual") {
      await updateManualAsset({
        id: device.id,
        payload: { type: assetType },
        user: req.user
      });
    } else {
      await updateDeviceType({ deviceId: device.id, assetType, userId: req.user.id });
      await addAssetHistory({
        assetId: device.id,
        eventType: "type",
        message: "Tipo do aparelho alterado",
        oldValue: device.assetType,
        newValue: assetType,
        userId: req.user.id,
        userName: req.user.name
      });
    }

    await addLog({
      type: "device_type_update",
      message: `Device type updated: ${device.name}`,
      userId: req.user.id,
      meta: { deviceId: device.id, oldType: device.assetType, newType: assetType }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after device type update", error);
    });

    return res.json({ device: await getDeviceDetails(device.id) });
  } catch (error) {
    next(error);
  }
}

export async function moveToSegment(req, res, next) {
  try {
    const device = await getDeviceDetails(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    const segmentId = req.body.segmentId;

    if (!segmentId) {
      return res.status(400).json({ message: "segmentId is required" });
    }

    const assignment = await updateDeviceSegment({
      deviceId: req.params.id,
      segmentId,
      userId: req.user.id
    });

    const reason = req.body.reason;
    const maintenanceMessage =
      reason === "maintenance"
        ? "Maquina colocada em manutencao"
        : reason === "maintenance_exit"
          ? "Maquina retirada da manutencao"
          : "Mudanca de segmento";

    await addAssetHistory({
      assetId: device.id,
      eventType: reason === "maintenance" || reason === "maintenance_exit" ? "maintenance" : "segment",
      message: maintenanceMessage,
      oldValue: device.segmentName,
      newValue: assignment.segmentName,
      userId: req.user.id,
      userName: req.user.name
    });

    await addLog({
      type: "device_segment_update",
      message: `Device moved to segment: ${device.name}`,
      userId: req.user.id,
      meta: { deviceId: device.id, segmentId }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after device segment update", error);
    });

    const updatedDevice = await getDeviceDetails(req.params.id);

    return res.json({ assignment, device: updatedDevice });
  } catch (error) {
    next(error);
  }
}

export async function removeDevice(req, res, next) {
  try {
    const device = await getDeviceDetails(req.params.id);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    if (device.source === "manual") {
      await deleteManualAsset({ id: device.id, user: req.user });
    } else {
      await addAssetHistory({
        assetId: device.id,
        eventType: "removed",
        message: "Maquina removida do inventario",
        oldValue: device.segmentName,
        newValue: "Removida",
        userId: req.user.id,
        userName: req.user.name
      });
      await markDeviceRemoved({
        deviceId: device.id,
        assetType: device.assetType || "desktop",
        userId: req.user.id
      });
    }

    await addLog({
      type: "device_remove",
      message: `Device removed from inventory: ${device.name}`,
      userId: req.user.id,
      meta: { deviceId: device.id, source: device.source }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after device remove", error);
    });

    return res.json({ removed: true, deviceId: device.id });
  } catch (error) {
    next(error);
  }
}
