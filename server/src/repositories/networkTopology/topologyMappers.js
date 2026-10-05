export function mapFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function nodeFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    nodeType: row.node_type,
    assetId: row.asset_id,
    refId: row.ref_id,
    x: Number(row.x),
    y: Number(row.y),
    pinned: Boolean(row.pinned),
    labelOverride: row.label_override,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function linkFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    mapId: row.map_id,
    sourceType: row.source_type,
    targetType: row.target_type,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    label: row.label,
    type: row.type,
    statusOverride: row.status_override,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
