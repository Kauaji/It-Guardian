import { createHash, randomUUID } from "node:crypto";
import { query } from "../database.js";

const openStatuses = ["requested", "waiting_consent", "connecting", "active"];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function computeEventHash({
  previousHash,
  sessionId,
  assetId,
  serviceOrderId,
  actorType,
  actorUserId,
  actorName,
  eventType,
  message,
  metadata
}) {
  const payload = JSON.stringify(
    canonicalize({
      previousHash: previousHash || "",
      sessionId,
      assetId,
      serviceOrderId: serviceOrderId || null,
      actorType,
      actorUserId: actorUserId || null,
      actorName: actorName || null,
      eventType,
      message,
      metadata: metadata || {}
    })
  );
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function sessionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    assetId: row.asset_id,
    serviceOrderId: row.service_order_id,
    technicianUserId: row.technician_user_id,
    technicianName: row.technician_name,
    reauthId: row.reauth_id,
    status: row.status,
    requestedMode: row.requested_mode,
    controlConsentGranted: Boolean(row.control_consent_granted),
    remoteControlEnabled: Boolean(row.remote_control_enabled),
    privacyModeEnabled: Boolean(row.privacy_mode_enabled),
    adminActionsEnabled: Boolean(row.admin_actions_enabled),
    consentRequired: Boolean(row.consent_required),
    consentStatus: row.consent_status,
    consentRequestedAt: row.consent_requested_at,
    consentRespondedAt: row.consent_responded_at,
    selectedMonitorId: row.selected_monitor_id,
    monitorCount: Number(row.monitor_count || 0),
    reason: row.reason,
    environment: row.environment_name,
    connectionMode: row.connection_mode,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    endReason: row.end_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function eventFromRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    sessionId: row.session_id,
    assetId: row.asset_id,
    serviceOrderId: row.service_order_id,
    actorType: row.actor_type,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    eventType: row.event_type,
    message: row.message,
    metadata,
    eventHash: row.event_hash || null,
    previousEventHash: row.previous_event_hash || null,
    createdAt: row.created_at
  };
}

export async function createRemoteAssistanceSession({
  id = randomUUID(),
  assetId,
  serviceOrderId = null,
  technician,
  reauthId,
  status = "waiting_consent",
  requestedMode,
  consentRequired,
  consentStatus = "pending",
  viewerTokenHash,
  agentTokenHash,
  reason,
  environment,
  expiresAt,
  db = query
}) {
  const result = await db(
    `
      INSERT INTO remote_assistance_sessions (
        id, asset_id, service_order_id, technician_user_id, technician_name,
        reauth_id, status, requested_mode, consent_required, consent_status,
        consent_requested_at, viewer_token_hash, agent_token_hash, reason,
        environment_name, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              CASE WHEN $9 THEN NOW() ELSE NULL END, $11, $12, $13, $14, $15)
      RETURNING *
    `,
    [
      id,
      assetId,
      serviceOrderId,
      technician?.id || null,
      technician?.name || null,
      reauthId || null,
      status,
      requestedMode,
      Boolean(consentRequired),
      consentStatus,
      viewerTokenHash,
      agentTokenHash,
      reason,
      environment,
      expiresAt
    ]
  );
  return sessionFromRow(result.rows[0]);
}

export async function findRemoteAssistanceSessionById(id, db = query) {
  const result = await db("SELECT * FROM remote_assistance_sessions WHERE id = $1", [id]);
  return sessionFromRow(result.rows[0]);
}

export async function findOpenRemoteAssistanceSessionForAsset(assetId, db = query) {
  const result = await db(
    `
      SELECT *
      FROM remote_assistance_sessions
      WHERE asset_id = $1
        AND status = ANY($2::text[])
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [assetId, openStatuses]
  );
  return sessionFromRow(result.rows[0]);
}

export async function findPendingRemoteAssistanceSessionForAsset(assetId, db = query) {
  const result = await db(
    `
      SELECT *
      FROM remote_assistance_sessions
      WHERE asset_id = $1
        AND status = 'waiting_consent'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [assetId]
  );
  return sessionFromRow(result.rows[0]);
}

export async function setRemoteAssistanceConsent({
  id,
  granted,
  controlAllowed,
  selectedMonitorId = null,
  monitorCount = 0,
  db = query
}) {
  const status = granted ? "active" : "consent_denied";
  const consentStatus = granted ? "granted" : "denied";
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = $2,
          consent_status = $3,
          control_consent_granted = $4,
          remote_control_enabled = FALSE,
          selected_monitor_id = $5,
          monitor_count = $6,
          consent_responded_at = NOW(),
          started_at = CASE WHEN $2 = 'active' THEN NOW() ELSE started_at END,
          ended_at = CASE WHEN $2 = 'consent_denied' THEN NOW() ELSE ended_at END,
          last_seen_at = NOW(),
          end_reason = CASE WHEN $2 = 'consent_denied' THEN 'consent_denied' ELSE end_reason END,
          updated_at = NOW()
      WHERE id = $1 AND status = 'waiting_consent' AND expires_at > NOW()
      RETURNING *
    `,
    [id, status, consentStatus, Boolean(controlAllowed), selectedMonitorId, monitorCount]
  );
  return sessionFromRow(result.rows[0]);
}

export async function setRemoteAssistanceMonitor(id, selectedMonitorId, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET selected_monitor_id = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'active' AND expires_at > NOW()
      RETURNING *
    `,
    [id, selectedMonitorId]
  );
  return sessionFromRow(result.rows[0]);
}

export async function setRemoteAssistanceControl(id, enabled, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET remote_control_enabled = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'active' AND expires_at > NOW()
      RETURNING *
    `,
    [id, Boolean(enabled)]
  );
  return sessionFromRow(result.rows[0]);
}

export async function touchRemoteAssistanceSession(id, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET last_seen_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status IN ('waiting_consent', 'connecting', 'active')
      RETURNING *
    `,
    [id]
  );
  return sessionFromRow(result.rows[0]);
}

export async function endRemoteAssistanceSession(id, endReason, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = 'ended', ended_at = NOW(), end_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = ANY($3::text[])
      RETURNING *
    `,
    [id, endReason, openStatuses]
  );
  return sessionFromRow(result.rows[0]);
}

export async function failRemoteAssistanceSession(id, endReason, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = 'failed', ended_at = NOW(), end_reason = $2, updated_at = NOW()
      WHERE id = $1 AND status = ANY($3::text[])
      RETURNING *
    `,
    [id, endReason, openStatuses]
  );
  return sessionFromRow(result.rows[0]);
}

export async function expireRemoteAssistanceSessions(db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = 'expired', ended_at = NOW(), end_reason = 'expired', updated_at = NOW()
      WHERE status = ANY($1::text[]) AND expires_at <= NOW()
      RETURNING *
    `,
    [openStatuses]
  );
  return result.rows.map(sessionFromRow);
}

export async function failStaleRemoteAssistanceSessions(staleBefore, db = query) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = 'failed', ended_at = NOW(), end_reason = 'agent_timeout', updated_at = NOW()
      WHERE status = 'active'
        AND COALESCE(last_seen_at, started_at, created_at) < $1
      RETURNING *
    `,
    [staleBefore]
  );
  return result.rows.map(sessionFromRow);
}

export async function endRemoteAssistanceSessionsForTechnician(
  technicianUserId,
  endReason = "technician_logout",
  db = query
) {
  const result = await db(
    `
      UPDATE remote_assistance_sessions
      SET status = 'ended', ended_at = NOW(), end_reason = $2, updated_at = NOW()
      WHERE technician_user_id = $1 AND status = ANY($3::text[])
      RETURNING *
    `,
    [technicianUserId, endReason, openStatuses]
  );
  return result.rows.map(sessionFromRow);
}

export async function addRemoteAssistanceEvent({
  sessionId,
  assetId,
  serviceOrderId = null,
  actorType,
  actorUserId = null,
  actorName = null,
  eventType,
  message,
  metadata = {},
  db = query
}) {
  const previous = await db(
    `
      SELECT event_hash FROM remote_assistance_events
      WHERE session_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [sessionId]
  );
  const previousHash = previous.rows[0]?.event_hash || null;
  const eventHash = computeEventHash({
    previousHash,
    sessionId,
    assetId,
    serviceOrderId,
    actorType,
    actorUserId,
    actorName,
    eventType,
    message,
    metadata
  });

  const result = await db(
    `
      INSERT INTO remote_assistance_events (
        id, session_id, asset_id, service_order_id, actor_type, actor_user_id,
        actor_name, event_type, message, metadata, event_hash, previous_event_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
      RETURNING *
    `,
    [
      randomUUID(),
      sessionId,
      assetId,
      serviceOrderId,
      actorType,
      actorUserId,
      actorName,
      eventType,
      message,
      JSON.stringify(metadata || {}),
      eventHash,
      previousHash
    ]
  );
  return eventFromRow(result.rows[0]);
}

export async function listRemoteAssistanceEvents(sessionId, db = query) {
  const result = await db(
    `
      SELECT * FROM remote_assistance_events
      WHERE session_id = $1
      ORDER BY created_at ASC
    `,
    [sessionId]
  );
  return result.rows.map(eventFromRow);
}

export async function listRemoteAssistanceEventsByAssetId(assetId, { limit = 50 } = {}, db = query) {
  const result = await db(
    `
      SELECT * FROM remote_assistance_events
      WHERE asset_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [assetId, limit]
  );
  return result.rows.map(eventFromRow);
}

export async function verifyRemoteAssistanceEventChain(sessionId, db = query) {
  const events = await listRemoteAssistanceEvents(sessionId, db);
  let previousHash = null;

  for (const event of events) {
    const expectedHash = computeEventHash({
      previousHash,
      sessionId,
      assetId: event.assetId,
      serviceOrderId: event.serviceOrderId,
      actorType: event.actorType,
      actorUserId: event.actorUserId,
      actorName: event.actorName,
      eventType: event.eventType,
      message: event.message,
      metadata: event.metadata
    });

    if (event.previousEventHash !== previousHash || event.eventHash !== expectedHash) {
      return {
        valid: false,
        totalEvents: events.length,
        brokenAtEventId: event.id,
        brokenAtIndex: events.indexOf(event)
      };
    }

    previousHash = event.eventHash;
  }

  return { valid: true, totalEvents: events.length, brokenAtEventId: null, brokenAtIndex: null };
}

export async function validateRemoteTokenHash({ id, field, tokenHash, db = query }) {
  const allowedFields = new Set(["viewer_token_hash", "agent_token_hash"]);
  if (!allowedFields.has(field)) return false;
  const result = await db(
    `
      SELECT id FROM remote_assistance_sessions
      WHERE id = $1
        AND ${field} = $2
        AND status = ANY($3::text[])
        AND expires_at > NOW()
      LIMIT 1
    `,
    [id, tokenHash, openStatuses]
  );
  return Boolean(result.rowCount);
}

export const remoteAssistanceOpenStatuses = Object.freeze([...openStatuses]);
