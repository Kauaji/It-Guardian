export const migration018NetworkTopologyMap = {
  id: "018-network-topology-map",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS network_topology_maps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        scope_type TEXT NOT NULL DEFAULT 'global'
          CHECK (scope_type IN ('global', 'inventory_tab', 'group', 'segment')),
        scope_id TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS network_topology_nodes (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES network_topology_maps(id) ON DELETE CASCADE,
        asset_id TEXT NOT NULL,
        x DOUBLE PRECISION NOT NULL DEFAULT 0,
        y DOUBLE PRECISION NOT NULL DEFAULT 0,
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        label_override TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (map_id, asset_id)
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_network_topology_nodes_map
      ON network_topology_nodes(map_id);
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS network_topology_links (
        id TEXT PRIMARY KEY,
        map_id TEXT NOT NULL REFERENCES network_topology_maps(id) ON DELETE CASCADE,
        source_asset_id TEXT NOT NULL,
        target_asset_id TEXT NOT NULL,
        label TEXT,
        type TEXT NOT NULL DEFAULT 'unknown'
          CHECK (type IN ('ethernet', 'wifi', 'fiber', 'logical', 'unknown')),
        status_override TEXT
          CHECK (status_override IS NULL OR status_override IN
            ('online', 'warning', 'critical', 'offline', 'unknown', 'manual')),
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (source_asset_id <> target_asset_id),
        UNIQUE (map_id, source_asset_id, target_asset_id)
      );
    `);
    await db(`
      CREATE INDEX IF NOT EXISTS idx_network_topology_links_map
      ON network_topology_links(map_id);
    `);
  }
};
