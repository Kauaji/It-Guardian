export const migration007ProductKeyMonitoring = {
  id: "007-product-key-monitoring",
  async up(db) {
    await db("ALTER TABLE product_keys ADD COLUMN IF NOT EXISTS ocs_server_url TEXT;");
    await db("ALTER TABLE product_keys ADD COLUMN IF NOT EXISTS zabbix_server TEXT;");
    await db("ALTER TABLE product_keys ADD COLUMN IF NOT EXISTS zabbix_server_active TEXT;");
  }
};
