export const migration026NetworkTopologyClusterNodes = {
  id: "026-network-topology-cluster-nodes",
  async up(db) {
    await db(`
      ALTER TABLE network_topology_nodes
      ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'asset'
        CHECK (node_type IN ('asset', 'segment', 'group'));
    `);
    await db(`
      ALTER TABLE network_topology_nodes
      ADD COLUMN IF NOT EXISTS ref_id TEXT;
    `);
    await db(`
      ALTER TABLE network_topology_nodes
      ALTER COLUMN asset_id DROP NOT NULL;
    `);
    await db(`
      ALTER TABLE network_topology_nodes
      ADD CONSTRAINT network_topology_nodes_type_ref_consistency CHECK (
        (node_type = 'asset' AND asset_id IS NOT NULL AND ref_id IS NULL)
        OR (node_type IN ('segment', 'group') AND ref_id IS NOT NULL AND asset_id IS NULL)
      );
    `);
    await db(`
      ALTER TABLE network_topology_nodes
      ADD CONSTRAINT network_topology_nodes_map_type_ref_unique UNIQUE (map_id, node_type, ref_id);
    `);

    await db(`
      ALTER TABLE network_topology_links
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'asset'
        CHECK (source_type IN ('asset', 'segment', 'group'));
    `);
    await db(`
      ALTER TABLE network_topology_links
      ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'asset'
        CHECK (target_type IN ('asset', 'segment', 'group'));
    `);
    await db(`
      ALTER TABLE network_topology_links
      ADD CONSTRAINT network_topology_links_type_match CHECK (source_type = target_type);
    `);
  }
};
