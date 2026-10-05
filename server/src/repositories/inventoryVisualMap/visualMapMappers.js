import { parseJsonField, parsePoints } from "../../domain/inventoryVisualMap/visualMapPayload.js";

export function mapFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    environmentId: row.environment_id,
    groupId: row.group_id,
    segmentId: row.segment_id,
    floorLabel: row.floor_label,
    width: Number(row.width),
    depth: Number(row.depth),
    scale: Number(row.scale),
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectCount: Number(row.object_count || 0)
  };
}

export function objectFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    layer: row.layer,
    presetType: row.preset_type,
    objectType: row.preset_type,
    label: row.label,
    linkedAssetId: row.linked_asset_id,
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    positionZ: Number(row.position_z),
    rotationX: Number(row.rotation_x),
    rotationY: Number(row.rotation_y),
    rotationZ: Number(row.rotation_z),
    width: Number(row.width),
    depth: Number(row.depth),
    height: Number(row.height),
    color: row.color,
    notes: row.notes,
    metadata: parseJsonField(row.metadata),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function connectionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    layer: row.layer,
    connectionType: row.connection_type,
    label: row.label,
    sourceObjectId: row.source_object_id,
    targetObjectId: row.target_object_id,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    points: parsePoints(row.points_json),
    color: row.color,
    thickness: Number(row.thickness),
    dashed: Boolean(row.dashed),
    notes: row.notes,
    metadata: parseJsonField(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
