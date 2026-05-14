import { randomUUID } from "node:crypto";
import { query } from "../database.js";

export const DEFAULT_SEGMENT_ID = "unorganized";
export const DEFAULT_SEGMENT_NAME = "Nao organizadas";
export const DEFAULT_SEGMENT_COLOR = "#1f7a61";

function normalizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : DEFAULT_SEGMENT_COLOR;
}

export async function seedDefaultSegment() {
  await query(
    `
      INSERT INTO inventory_segments (id, name, color, is_default)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          color = COALESCE(inventory_segments.color, EXCLUDED.color),
          is_default = TRUE,
          updated_at = NOW()
    `,
    [DEFAULT_SEGMENT_ID, DEFAULT_SEGMENT_NAME, DEFAULT_SEGMENT_COLOR]
  );
}

export async function listSegments() {
  const result = await query(`
    SELECT segments.id,
           segments.name,
           segments.color,
           segments.group_id,
           segments.is_default,
           segments.created_at,
           segments.updated_at,
           COUNT(device_segments.device_id)::int AS machine_count
    FROM inventory_segments segments
    LEFT JOIN device_segments ON device_segments.segment_id = segments.id
    GROUP BY segments.id, segments.name, segments.color, segments.group_id, segments.is_default, segments.created_at, segments.updated_at
    ORDER BY segments.is_default DESC, segments.created_at ASC
  `);

  return result.rows.map(fromRow);
}

export async function findSegmentById(id) {
  const result = await query(
    `
      SELECT id, name, is_default, created_at, updated_at
      , color, group_id
      FROM inventory_segments
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createSegment({ name, color, groupId = null, userId }) {
  await assertSegmentNameAvailable({ name, groupId });

  const result = await query(
    `
      INSERT INTO inventory_segments (id, name, color, group_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, color, group_id, is_default, created_at, updated_at
    `,
    [randomUUID(), name.trim(), normalizeColor(color), normalizeGroupId(groupId), userId]
  );

  return fromRow(result.rows[0]);
}

export async function updateSegment({ id, name, color, groupId }) {
  const existing = await findSegmentById(id);

  if (!existing) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.isDefault && name && name.trim() !== existing.name) {
    const error = new Error("Default segment cannot be renamed");
    error.statusCode = 400;
    throw error;
  }

  const nextName = name?.trim() || existing.name;
  const nextGroupId = groupId === undefined ? existing.groupId : normalizeGroupId(groupId);

  if (!existing.isDefault) {
    await assertSegmentNameAvailable({ name: nextName, groupId: nextGroupId, ignoreId: id });
  }

  const result = await query(
    `
      UPDATE inventory_segments
      SET name = $2,
          color = $3,
          group_id = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, color, group_id, is_default, created_at, updated_at
    `,
    [id, nextName, normalizeColor(color || existing.color), existing.isDefault ? null : nextGroupId]
  );

  return fromRow(result.rows[0]);
}

export const renameSegment = updateSegment;

export async function deleteSegment(id) {
  const existing = await findSegmentById(id);

  if (!existing) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }

  if (existing.isDefault) {
    const error = new Error("Default segment cannot be deleted");
    error.statusCode = 400;
    throw error;
  }

  await query(
    `
      UPDATE device_segments
      SET segment_id = $1,
          updated_at = NOW()
      WHERE segment_id = $2
    `,
    [DEFAULT_SEGMENT_ID, id]
  );

  await query("DELETE FROM inventory_segments WHERE id = $1", [id]);
  return existing;
}

export async function listDeviceSegmentMap() {
  const result = await query(`
      SELECT device_segments.device_id,
           segments.id AS segment_id,
           segments.name AS segment_name,
           segments.group_id AS segment_group_id
    FROM device_segments
    INNER JOIN inventory_segments segments ON segments.id = device_segments.segment_id
  `);

  return new Map(
    result.rows.map((row) => [
      row.device_id,
      {
        segmentId: row.segment_id,
        segmentName: row.segment_name,
        segmentGroupId: row.segment_group_id
      }
    ])
  );
}

export async function updateDeviceSegment({ deviceId, segmentId, userId }) {
  const segment = await findSegmentById(segmentId);

  if (!segment) {
    const error = new Error("Segment not found");
    error.statusCode = 404;
    throw error;
  }

  const result = await query(
    `
      INSERT INTO device_segments (device_id, segment_id, updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (device_id)
      DO UPDATE SET segment_id = EXCLUDED.segment_id,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
      RETURNING device_id, segment_id, updated_at
    `,
    [deviceId, segmentId, userId]
  );

  return {
    deviceId: result.rows[0].device_id,
    segmentId: result.rows[0].segment_id,
    segmentName: segment.name,
    updatedAt: result.rows[0].updated_at
  };
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || DEFAULT_SEGMENT_COLOR,
    groupId: row.group_id || "",
    isDefault: row.is_default,
    machineCount: Number(row.machine_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeGroupId(groupId) {
  return groupId ? String(groupId) : null;
}

async function assertSegmentNameAvailable({ name, groupId = null, ignoreId = null }) {
  const result = await query(
    `
      SELECT id
      FROM inventory_segments
      WHERE lower(name) = lower($1)
        AND COALESCE(group_id, '') = COALESCE($2, '')
        AND ($3::text IS NULL OR id <> $3)
      LIMIT 1
    `,
    [name, normalizeGroupId(groupId), ignoreId]
  );

  if (result.rows.length) {
    const error = new Error("Ja existe um segmento com esse nome neste grupo.");
    error.statusCode = 409;
    throw error;
  }
}
