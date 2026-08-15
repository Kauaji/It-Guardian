import { createHash } from "node:crypto";

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

function computeEventHash({ previousHash, sessionId, assetId, serviceOrderId, actorType, actorUserId, actorName, eventType, message, metadata }) {
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

export const migration017RemoteAssistanceEventHashChain = {
  id: "017-remote-assistance-event-hash-chain",
  async up(db) {
    await db(`
      ALTER TABLE remote_assistance_events
      ADD COLUMN IF NOT EXISTS event_hash TEXT;
    `);
    await db(`
      ALTER TABLE remote_assistance_events
      ADD COLUMN IF NOT EXISTS previous_event_hash TEXT;
    `);

    // Backfill a cadeia para eventos ja existentes, em ordem cronologica por sessao,
    // para que o encadeamento passe a valer tambem para o historico anterior a esta migracao.
    const sessions = await db(`
      SELECT DISTINCT session_id FROM remote_assistance_events WHERE event_hash IS NULL
    `);
    for (const { session_id: sessionId } of sessions.rows) {
      const events = await db(
        `
          SELECT id, asset_id, service_order_id, actor_type, actor_user_id, actor_name,
                 event_type, message, metadata
          FROM remote_assistance_events
          WHERE session_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [sessionId]
      );
      let previousHash = null;
      for (const row of events.rows) {
        const eventHash = computeEventHash({
          previousHash,
          sessionId,
          assetId: row.asset_id,
          serviceOrderId: row.service_order_id,
          actorType: row.actor_type,
          actorUserId: row.actor_user_id,
          actorName: row.actor_name,
          eventType: row.event_type,
          message: row.message,
          metadata: row.metadata
        });
        await db(
          `UPDATE remote_assistance_events SET event_hash = $2, previous_event_hash = $3 WHERE id = $1`,
          [row.id, eventHash, previousHash]
        );
        previousHash = eventHash;
      }
    }
  }
};
