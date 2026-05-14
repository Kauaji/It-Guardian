import { randomUUID } from "node:crypto";
import { query } from "../database.js";

const DEFAULT_GROUP_COLOR = "#8b9bb0";

function normalizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color : DEFAULT_GROUP_COLOR;
}

export async function listSegmentGroups() {
  const result = await query(`
    SELECT groups.id,
           groups.name,
           groups.color,
           groups.collapsed,
           groups.created_at,
           groups.updated_at,
           COUNT(segments.id)::int AS segment_count,
           COALESCE(
             json_agg(segments.id ORDER BY segments.created_at ASC)
             FILTER (WHERE segments.id IS NOT NULL),
             '[]'::json
           ) AS segment_ids
    FROM segment_groups groups
    LEFT JOIN inventory_segments segments ON segments.group_id = groups.id
    GROUP BY groups.id, groups.name, groups.color, groups.collapsed, groups.created_at, groups.updated_at
    ORDER BY groups.created_at ASC
  `);

  return result.rows.map(fromRow);
}

export async function findSegmentGroupById(id) {
  const result = await query(
    `
      SELECT id, name, color, collapsed, created_at, updated_at
      FROM segment_groups
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createSegmentGroup({ name, color, userId }) {
  await assertGroupNameAvailable(name);

  const result = await query(
    `
      INSERT INTO segment_groups (id, name, color, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, color, collapsed, created_at, updated_at
    `,
    [randomUUID(), name.trim(), normalizeColor(color), userId]
  );

  return fromRow(result.rows[0]);
}

export async function updateSegmentGroup({ id, name, color, collapsed }) {
  const existing = await findSegmentGroupById(id);

  if (!existing) {
    const error = new Error("Grupo nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  if (name !== undefined) {
    await assertGroupNameAvailable(name, id);
  }

  const result = await query(
    `
      UPDATE segment_groups
      SET name = $2,
          color = $3,
          collapsed = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, color, collapsed, created_at, updated_at
    `,
    [
      id,
      name?.trim() || existing.name,
      normalizeColor(color || existing.color),
      collapsed === undefined ? existing.collapsed : Boolean(collapsed)
    ]
  );

  return fromRow(result.rows[0]);
}

export async function deleteSegmentGroup(id) {
  const existing = await findSegmentGroupById(id);

  if (!existing) {
    const error = new Error("Grupo nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  await query(
    `
      UPDATE inventory_segments
      SET group_id = NULL,
          updated_at = NOW()
      WHERE group_id = $1
    `,
    [id]
  );

  await query("DELETE FROM segment_groups WHERE id = $1", [id]);
  return existing;
}

async function assertGroupNameAvailable(name, ignoreId = null) {
  const result = await query(
    `
      SELECT id
      FROM segment_groups
      WHERE lower(name) = lower($1)
        AND ($2::text IS NULL OR id <> $2)
      LIMIT 1
    `,
    [name, ignoreId]
  );

  if (result.rows.length) {
    const error = new Error("Ja existe um grupo com esse nome.");
    error.statusCode = 409;
    throw error;
  }
}

function fromRow(row) {
  const segmentIds = typeof row.segment_ids === "string" ? JSON.parse(row.segment_ids) : row.segment_ids;

  return {
    id: row.id,
    name: row.name,
    color: row.color || DEFAULT_GROUP_COLOR,
    collapsed: Boolean(row.collapsed),
    segmentCount: Number(row.segment_count || 0),
    segmentIds: Array.isArray(segmentIds) ? segmentIds : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
