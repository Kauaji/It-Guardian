import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function assetFromRow(row) {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    hostname: row.hostname,
    displayName: row.display_name,
    ip: row.ip,
    serialNumber: row.serial_number,
    assetTag: row.asset_tag,
    macAddress: row.mac_address,
    manufacturer: row.manufacturer,
    model: row.model,
    operatingSystem: row.operating_system,
    status: row.status,
    metrics: parseJson(row.metrics, {}),
    hardware: parseJson(row.hardware, {}),
    correlation: parseJson(row.correlation, {}),
    rawData: parseJson(row.raw_data, null),
    collectedAt: row.collected_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function alertFromRow(row) {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    assetExternalId: row.asset_external_id,
    assetHostname: row.asset_hostname,
    name: row.name,
    severity: row.severity,
    status: row.status,
    occurredAt: row.occurred_at,
    resolvedAt: row.resolved_at,
    metadata: parseJson(row.metadata, {}),
    rawData: parseJson(row.raw_data, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function stateFromRow(row) {
  if (!row) return null;
  return {
    source: row.source,
    enabled: row.enabled,
    mode: row.mode,
    baseUrl: row.base_url,
    lastStatus: row.last_status,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    importedAssets: row.imported_assets,
    importedAlerts: row.imported_alerts,
    metadata: parseJson(row.metadata, {}),
    updatedAt: row.updated_at
  };
}

async function upsertAsset(db, asset) {
  const result = await db(
    `
      INSERT INTO integration_assets (
        id, source, external_id, hostname, display_name, ip, serial_number,
        asset_tag, mac_address, manufacturer, model, operating_system, status,
        metrics, hardware, correlation, raw_data, collected_at, last_seen_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, NOW()
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        display_name = EXCLUDED.display_name,
        ip = EXCLUDED.ip,
        serial_number = EXCLUDED.serial_number,
        asset_tag = EXCLUDED.asset_tag,
        mac_address = EXCLUDED.mac_address,
        manufacturer = EXCLUDED.manufacturer,
        model = EXCLUDED.model,
        operating_system = EXCLUDED.operating_system,
        status = EXCLUDED.status,
        metrics = EXCLUDED.metrics,
        hardware = EXCLUDED.hardware,
        correlation = EXCLUDED.correlation,
        raw_data = EXCLUDED.raw_data,
        collected_at = EXCLUDED.collected_at,
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `,
    [
      randomUUID(),
      asset.source,
      asset.externalId,
      asset.hostname,
      asset.displayName,
      asset.ip,
      asset.serialNumber,
      asset.assetTag,
      asset.macAddress,
      asset.manufacturer,
      asset.model,
      asset.operatingSystem,
      asset.status,
      asset.metrics || {},
      asset.hardware || {},
      asset.correlation || {},
      asset.rawData,
      asset.collectedAt
    ]
  );
  return assetFromRow(result.rows[0]);
}

async function upsertAlert(db, alert) {
  const result = await db(
    `
      INSERT INTO integration_alerts (
        id, source, external_id, asset_external_id, asset_hostname, name,
        severity, status, occurred_at, resolved_at, metadata, raw_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (source, external_id) DO UPDATE SET
        asset_external_id = EXCLUDED.asset_external_id,
        asset_hostname = EXCLUDED.asset_hostname,
        name = EXCLUDED.name,
        severity = EXCLUDED.severity,
        status = EXCLUDED.status,
        occurred_at = EXCLUDED.occurred_at,
        resolved_at = EXCLUDED.resolved_at,
        metadata = EXCLUDED.metadata,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
      RETURNING *
    `,
    [
      randomUUID(),
      alert.source,
      alert.externalId,
      alert.assetExternalId,
      alert.assetHostname,
      alert.name,
      alert.severity,
      alert.status,
      alert.occurredAt,
      alert.resolvedAt,
      alert.metadata || {},
      alert.rawData
    ]
  );
  return alertFromRow(result.rows[0]);
}

async function upsertConflict(db, conflict) {
  await db(
    `
      INSERT INTO integration_conflicts (
        id, source, external_id, reason, candidate_ids, evidence, resolved
      )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      ON CONFLICT (source, external_id) DO UPDATE SET
        reason = EXCLUDED.reason,
        candidate_ids = EXCLUDED.candidate_ids,
        evidence = EXCLUDED.evidence,
        resolved = FALSE,
        updated_at = NOW()
    `,
    [
      randomUUID(),
      conflict.source,
      conflict.externalId,
      conflict.reason,
      JSON.stringify(conflict.candidateIds || []),
      JSON.stringify(conflict.evidence || [])
    ]
  );
}

async function updateState(db, state) {
  const result = await db(
    `
      INSERT INTO integration_sync_state (
        source, enabled, mode, base_url, last_status, last_sync_at,
        last_error, imported_assets, imported_alerts, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (source) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        mode = EXCLUDED.mode,
        base_url = EXCLUDED.base_url,
        last_status = EXCLUDED.last_status,
        last_sync_at = EXCLUDED.last_sync_at,
        last_error = EXCLUDED.last_error,
        imported_assets = EXCLUDED.imported_assets,
        imported_alerts = EXCLUDED.imported_alerts,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `,
    [
      state.source,
      Boolean(state.enabled),
      state.mode || "disabled",
      state.baseUrl || null,
      state.lastStatus || "unknown",
      state.lastSyncAt || null,
      state.lastError || null,
      Number(state.importedAssets || 0),
      Number(state.importedAlerts || 0),
      state.metadata || {}
    ]
  );
  return stateFromRow(result.rows[0]);
}

export async function saveIntegrationSync({
  source,
  enabled,
  mode,
  baseUrl,
  assets = [],
  alerts = [],
  conflicts = [],
  metadata = {}
}) {
  return withTransaction(async (db) => {
    const savedAssets = [];
    const savedAlerts = [];
    for (const asset of assets) savedAssets.push(await upsertAsset(db, asset));
    for (const alert of alerts) savedAlerts.push(await upsertAlert(db, alert));
    for (const conflict of conflicts) await upsertConflict(db, conflict);

    const syncedAt = new Date().toISOString();
    const state = await updateState(db, {
      source,
      enabled,
      mode,
      baseUrl,
      lastStatus: "success",
      lastSyncAt: syncedAt,
      lastError: null,
      importedAssets: savedAssets.length,
      importedAlerts: savedAlerts.length,
      metadata: { ...metadata, conflicts: conflicts.length }
    });
    return { state, assets: savedAssets, alerts: savedAlerts, conflicts };
  });
}

export async function recordIntegrationFailure({ source, enabled, mode, baseUrl, message }) {
  return withTransaction((db) =>
    updateState(db, {
      source,
      enabled,
      mode,
      baseUrl,
      lastStatus: "error",
      lastError: message,
      metadata: {}
    })
  );
}

export async function getIntegrationState(source) {
  const result = await query(
    "SELECT * FROM integration_sync_state WHERE source = $1 LIMIT 1",
    [source]
  );
  return stateFromRow(result.rows[0]);
}

export async function listIntegrationAssets({ source = null } = {}) {
  const result = source
    ? await query(
        "SELECT * FROM integration_assets WHERE source = $1 ORDER BY display_name",
        [source]
      )
    : await query("SELECT * FROM integration_assets ORDER BY source, display_name");
  return result.rows.map(assetFromRow);
}

export async function findIntegrationAsset(source, externalId) {
  const result = await query(
    "SELECT * FROM integration_assets WHERE source = $1 AND external_id = $2 LIMIT 1",
    [source, externalId]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

export async function listIntegrationAlerts({ source = null, status = null } = {}) {
  const clauses = [];
  const values = [];
  if (source) {
    values.push(source);
    clauses.push(`source = $${values.length}`);
  }
  if (status) {
    values.push(status);
    clauses.push(`status = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await query(
    `SELECT * FROM integration_alerts ${where} ORDER BY occurred_at DESC`,
    values
  );
  return result.rows.map(alertFromRow);
}

export async function listOpenIntegrationConflicts(source) {
  const result = await query(
    `
      SELECT source, external_id, reason, candidate_ids, evidence, created_at, updated_at
      FROM integration_conflicts
      WHERE source = $1 AND resolved = FALSE
      ORDER BY created_at DESC
    `,
    [source]
  );
  return result.rows.map((row) => ({
    source: row.source,
    externalId: row.external_id,
    reason: row.reason,
    candidateIds: parseJson(row.candidate_ids, []),
    evidence: parseJson(row.evidence, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
