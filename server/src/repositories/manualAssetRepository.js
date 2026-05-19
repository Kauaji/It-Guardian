import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { addAssetHistory, listAssetHistory } from "./assetHistoryRepository.js";
import { checkPingStatus } from "../services/pingStatusService.js";

const seedAssets = [
  {
    id: "manual-printer-rh",
    name: "IMP-RH-01",
    type: "printer",
    brand: "Brother",
    model: "MFC-L8900CDW",
    assetTag: "NET-IMP-0001",
    ip: "10.10.6.40",
    macAddress: "30:05:5C:AA:10:40",
    hostname: "imp-rh-01",
    identificationMode: "fixed_ip",
    location: "RH - Sala 2",
    notes: "Impressora compartilhada do RH."
  },
  {
    id: "manual-ap-recepcao",
    name: "AP-RECEPCAO-01",
    type: "access_point",
    brand: "Ubiquiti",
    model: "UniFi U6 Pro",
    assetTag: "NET-AP-0001",
    ip: "10.10.0.45",
    macAddress: "78:45:58:10:20:45",
    hostname: "ap-recepcao-01",
    identificationMode: "mac_hostname",
    location: "Recepcao",
    notes: "Ativo pode mudar de IP se a reserva DHCP for removida."
  },
  {
    id: "manual-camera-galpao",
    name: "CAM-GALPAO-03",
    type: "camera_ip",
    brand: "Intelbras",
    model: "VIP 3230 B",
    assetTag: "NET-CAM-0003",
    ip: "10.10.2.23",
    macAddress: "84:16:F9:30:22:03",
    hostname: "cam-galpao-03",
    identificationMode: "fixed_ip",
    location: "Galpao",
    notes: "Camera externa com alerta quando fica offline."
  }
];

function normalizeOptional(value) {
  return value?.trim() || null;
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    brand: row.brand,
    model: row.model,
    assetTag: row.asset_tag,
    ip: row.ip,
    macAddress: row.mac_address,
    hostname: row.hostname,
    identificationMode: row.identification_mode,
    location: row.location,
    notes: row.notes,
    status: row.status,
    lastPingAt: row.last_ping_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function seedManualAssets() {
  for (const asset of seedAssets) {
    const ping = await checkPingStatus(asset);

    await query(
      `
        INSERT INTO manual_network_assets (
          id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
          identification_mode, location, notes, status, last_ping_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        asset.id,
        asset.name,
        asset.type,
        asset.brand,
        asset.model,
        asset.assetTag,
        asset.ip,
        asset.macAddress,
        asset.hostname,
        asset.identificationMode,
        asset.location,
        asset.notes,
        ping.status,
        ping.checkedAt
      ]
    );
  }
}

export async function listManualAssets() {
  const result = await query(`
    SELECT id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
           identification_mode, location, notes, status, last_ping_at, created_at, updated_at
    FROM manual_network_assets
    ORDER BY created_at ASC
  `);

  return result.rows.map(fromRow);
}

export async function findManualAssetById(id) {
  const result = await query(
    `
      SELECT id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
             identification_mode, location, notes, status, last_ping_at, created_at, updated_at
      FROM manual_network_assets
      WHERE id = $1
    `,
    [id]
  );

  if (!result.rows[0]) return null;

  return {
    ...fromRow(result.rows[0]),
    manualHistory: await listAssetHistory(id)
  };
}

export async function createManualAsset({ payload, user }) {
  const id = `manual-${randomUUID()}`;
  const asset = {
    id,
    name: payload.name.trim(),
    type: payload.type,
    brand: payload.brand.trim(),
    model: payload.model.trim(),
    assetTag: payload.assetTag.trim(),
    ip: payload.ip.trim(),
    macAddress: normalizeOptional(payload.macAddress),
    hostname: normalizeOptional(payload.hostname),
    identificationMode: payload.identificationMode || "fixed_ip",
    location: normalizeOptional(payload.location),
    notes: normalizeOptional(payload.notes)
  };
  const ping = await checkPingStatus(asset);

  const result = await query(
    `
      INSERT INTO manual_network_assets (
        id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
        identification_mode, location, notes, status, last_ping_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
                identification_mode, location, notes, status, last_ping_at, created_at, updated_at
    `,
    [
      asset.id,
      asset.name,
      asset.type,
      asset.brand,
      asset.model,
      asset.assetTag,
      asset.ip,
      asset.macAddress,
      asset.hostname,
      asset.identificationMode,
      asset.location,
      asset.notes,
      ping.status,
      ping.checkedAt,
      user.id
    ]
  );

  await addAssetHistory({
    assetId: id,
    eventType: "created",
    message: "Ativo manual criado",
    newValue: `${asset.name} (${asset.ip})`,
    userId: user.id,
    userName: user.name
  });

  return fromRow(result.rows[0]);
}

export async function updateManualAsset({ id, payload, user }) {
  const current = await findManualAssetById(id);
  if (!current) return null;

  const next = {
    name: payload.name?.trim() || current.name,
    type: payload.type || current.type,
    brand: payload.brand?.trim() || current.brand,
    model: payload.model?.trim() || current.model,
    assetTag: payload.assetTag?.trim() || current.assetTag,
    ip: payload.ip?.trim() || current.ip,
    macAddress: payload.macAddress !== undefined ? normalizeOptional(payload.macAddress) : current.macAddress,
    hostname: payload.hostname !== undefined ? normalizeOptional(payload.hostname) : current.hostname,
    identificationMode: payload.identificationMode || current.identificationMode,
    location: payload.location !== undefined ? normalizeOptional(payload.location) : current.location,
    notes: payload.notes !== undefined ? normalizeOptional(payload.notes) : current.notes
  };

  const result = await query(
    `
      UPDATE manual_network_assets
      SET name = $2,
          type = $3,
          brand = $4,
          model = $5,
          asset_tag = $6,
          ip = $7,
          mac_address = $8,
          hostname = $9,
          identification_mode = $10,
          location = $11,
          notes = $12,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
                identification_mode, location, notes, status, last_ping_at, created_at, updated_at
    `,
    [
      id,
      next.name,
      next.type,
      next.brand,
      next.model,
      next.assetTag,
      next.ip,
      next.macAddress,
      next.hostname,
      next.identificationMode,
      next.location,
      next.notes
    ]
  );

  const changedFields = [
    ["name", "nome", current.name, next.name],
    ["type", "tipo", current.type, next.type],
    ["ip", "IP", current.ip, next.ip],
    ["brandModel", "marca/modelo", `${current.brand} ${current.model}`, `${next.brand} ${next.model}`],
    ["assetTag", "patrimonio", current.assetTag, next.assetTag]
  ].filter(([, , oldValue, newValue]) => oldValue !== newValue);

  for (const [, label, oldValue, newValue] of changedFields) {
    await addAssetHistory({
      assetId: id,
      eventType: "updated",
      message: `Alteracao de ${label}`,
      oldValue,
      newValue,
      userId: user.id,
      userName: user.name
    });
  }

  return fromRow(result.rows[0]);
}

export async function refreshManualAssetPing({ id, user = null }) {
  const asset = await findManualAssetById(id);
  if (!asset) return null;

  const ping = await checkPingStatus(asset);
  const result = await query(
    `
      UPDATE manual_network_assets
      SET status = $2,
          last_ping_at = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, type, brand, model, asset_tag, ip, mac_address, hostname,
                identification_mode, location, notes, status, last_ping_at, created_at, updated_at
    `,
    [id, ping.status, ping.checkedAt]
  );

  if (asset.status !== ping.status) {
    await addAssetHistory({
      assetId: id,
      eventType: "status",
      message: "Mudanca de status por ping",
      oldValue: asset.status,
      newValue: ping.status,
      userId: user?.id,
      userName: user?.name
    });
  }

  return { asset: fromRow(result.rows[0]), ping };
}

export async function deleteManualAsset({ id, user }) {
  const current = await findManualAssetById(id);
  if (!current) return null;

  await addAssetHistory({
    assetId: id,
    eventType: "removed",
    message: "Ativo removido do inventario",
    oldValue: `${current.name} (${current.ip})`,
    newValue: "Removido",
    userId: user?.id,
    userName: user?.name
  });

  await query("DELETE FROM device_segments WHERE device_id = $1", [id]);
  await query("DELETE FROM manual_network_assets WHERE id = $1", [id]);

  return current;
}
