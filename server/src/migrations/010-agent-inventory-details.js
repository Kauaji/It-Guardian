export const migration010AgentInventoryDetails = {
  id: "010-agent-inventory-details",
  async up(db) {
    await db(`
      ALTER TABLE agent_assets
      ADD COLUMN IF NOT EXISTS inventory_details JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
  }
};
