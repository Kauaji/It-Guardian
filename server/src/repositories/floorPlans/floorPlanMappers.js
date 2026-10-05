export function mapPlan(row, counts = {}) {
  return {
    id: row.id,
    inventoryTabId: row.inventory_tab_id,
    name: row.name,
    company: row.company,
    unit: row.unit,
    floorLabel: row.floor_label,
    status: row.status,
    width: Number(row.width),
    height: Number(row.height),
    gridSize: Number(row.grid_size),
    snapSize: Number(row.snap_size),
    activeFloorId: row.active_floor_id,
    objectCount: counts.objectCount || 0,
    assetCount: counts.assetCount || 0,
    floorCount: counts.floorCount || 0,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapFloor(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    level: Number(row.level),
    width: Number(row.width),
    height: Number(row.height),
    backgroundUrl: row.background_url,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapZone(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    zoneType: row.zone_type,
    groupId: row.group_id,
    segmentId: row.segment_id,
    name: row.name,
    color: row.color,
    geometry: row.geometry || {},
    orderIndex: Number(row.order_index || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapObject(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    objectType: row.object_type,
    category: row.category,
    label: row.label,
    linkedAssetId: row.linked_asset_id,
    groupId: row.group_id,
    segmentId: row.segment_id,
    x: Number(row.x),
    y: Number(row.y),
    width: Number(row.width),
    height: Number(row.height),
    rotation: Number(row.rotation),
    z: Number(row.z),
    height3d: Number(row.height_3d),
    color: row.color,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapConnectionPoint(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    pointType: row.point_type,
    label: row.label,
    linkedObjectId: row.linked_object_id,
    x: Number(row.x),
    y: Number(row.y),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapCableRoute(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    floorId: row.floor_id,
    routeType: row.route_type,
    label: row.label,
    sourcePointId: row.source_point_id,
    targetPointId: row.target_point_id,
    path: row.path || [],
    color: row.color,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
