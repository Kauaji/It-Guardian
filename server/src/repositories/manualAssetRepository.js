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
  },
  {
    id: "manual-switch-acesso-01",
    name: "SW-ACESSO-01",
    type: "switch",
    brand: "Cisco",
    model: "Catalyst 9200L-48P",
    assetTag: "NET-SW-0001",
    ip: "10.10.0.11",
    macAddress: "00:AA:6E:92:00:11",
    hostname: "sw-acesso-01",
    identificationMode: "fixed_ip",
    location: "Rack CPD - Andar 1",
    notes: "Switch PoE principal do primeiro andar."
  },
  {
    id: "manual-switch-acesso-02",
    name: "SW-ACESSO-02",
    type: "switch",
    brand: "Cisco",
    model: "Catalyst 9200L-24P",
    assetTag: "NET-SW-0002",
    ip: "10.10.0.12",
    macAddress: "00:AA:6E:92:00:12",
    hostname: "sw-acesso-02",
    identificationMode: "fixed_ip",
    location: "Rack Administrativo",
    notes: "Atende financeiro, RH e recepcao."
  },
  {
    id: "manual-ap-financeiro",
    name: "AP-FINANCEIRO-01",
    type: "access_point",
    brand: "Ubiquiti",
    model: "UniFi U6 Enterprise",
    assetTag: "NET-AP-0002",
    ip: "10.10.0.46",
    macAddress: "78:45:58:10:20:46",
    hostname: "ap-financeiro-01",
    identificationMode: "mac_hostname",
    location: "Financeiro",
    notes: "Cobertura Wi-Fi do financeiro e diretoria."
  },
  {
    id: "manual-ap-estoque",
    name: "AP-ESTOQUE-01",
    type: "access_point",
    brand: "Ubiquiti",
    model: "UniFi U6 Mesh",
    assetTag: "NET-AP-0003",
    ip: "10.10.0.47",
    macAddress: "78:45:58:10:20:47",
    hostname: "ap-estoque-01",
    identificationMode: "mac_hostname",
    location: "Estoque",
    notes: "Ponto de acesso para coletores e tablets do estoque."
  },
  {
    id: "manual-printer-financeiro",
    name: "IMP-FIN-01",
    type: "printer",
    brand: "HP",
    model: "LaserJet Enterprise M611",
    assetTag: "NET-IMP-0002",
    ip: "10.10.7.80",
    macAddress: "F8:BC:12:10:70:80",
    hostname: "imp-fin-01",
    identificationMode: "fixed_ip",
    location: "Financeiro",
    notes: "Impressora fiscal e relatorios financeiros."
  },
  {
    id: "manual-printer-expedicao",
    name: "IMP-EXPEDICAO-01",
    type: "printer",
    brand: "Zebra",
    model: "ZT411",
    assetTag: "NET-IMP-0003",
    ip: "10.10.9.81",
    macAddress: "00:07:4D:22:10:81",
    hostname: "imp-expedicao-01",
    identificationMode: "fixed_ip",
    location: "Expedicao",
    notes: "Impressora de etiquetas de envio."
  },
  {
    id: "manual-nas-arquivos-01",
    name: "NAS-ARQUIVOS-01",
    type: "nas",
    brand: "Synology",
    model: "DS1821+",
    assetTag: "NET-NAS-0001",
    ip: "10.10.1.90",
    macAddress: "00:11:32:AB:90:01",
    hostname: "nas-arquivos-01",
    identificationMode: "fixed_ip",
    location: "Rack CPD - Storage",
    notes: "Armazenamento de arquivos departamentais e snapshots."
  },
  {
    id: "manual-router-link-02",
    name: "RTR-LINK-02",
    type: "router",
    brand: "MikroTik",
    model: "CCR2004-1G-12S+2XS",
    assetTag: "NET-RTR-0002",
    ip: "10.10.0.2",
    macAddress: "48:A9:8A:20:00:02",
    hostname: "rtr-link-02",
    identificationMode: "fixed_ip",
    location: "Rack CPD - Borda",
    notes: "Roteador do link secundario de internet."
  },
  {
    id: "manual-camera-recepcao-01",
    name: "CAM-RECEPCAO-01",
    type: "camera_ip",
    brand: "Intelbras",
    model: "VIP 5220 SD",
    assetTag: "NET-CAM-0004",
    ip: "10.10.2.24",
    macAddress: "84:16:F9:30:22:04",
    hostname: "cam-recepcao-01",
    identificationMode: "fixed_ip",
    location: "Recepcao",
    notes: "Camera PTZ da entrada principal."
  },
  {
    id: "manual-camera-caixa-01",
    name: "CAM-CAIXA-01",
    type: "camera_ip",
    brand: "Hikvision",
    model: "DS-2CD2143G2",
    assetTag: "NET-CAM-0005",
    ip: "10.10.2.25",
    macAddress: "9C:A3:AA:40:22:25",
    hostname: "cam-caixa-01",
    identificationMode: "fixed_ip",
    location: "Frente de caixa",
    notes: "Camera dos caixas e atendimento."
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
