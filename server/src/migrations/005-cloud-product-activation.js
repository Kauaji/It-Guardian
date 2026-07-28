export const migration005CloudProductActivation = {
  id: "005-cloud-product-activation",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS product_keys (
        id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL UNIQUE,
        key_hint TEXT NOT NULL,
        display_name TEXT NOT NULL,
        organization_name TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        activation_limit INTEGER NOT NULL,
        activation_count INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMPTZ,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (activation_limit > 0),
        CHECK (activation_count >= 0)
      );
    `);

    await db(`
      CREATE TABLE IF NOT EXISTS device_activations (
        id TEXT PRIMARY KEY,
        product_key_id TEXT NOT NULL REFERENCES product_keys(id) ON DELETE RESTRICT,
        machine_fingerprint TEXT NOT NULL,
        hostname TEXT NOT NULL,
        alias TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        collector_version TEXT,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deactivated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (product_key_id, machine_fingerprint),
        CHECK (status IN ('active', 'deactivated'))
      );
    `);

    await db("ALTER TABLE agent_enrollments ADD COLUMN IF NOT EXISTS product_key_id TEXT REFERENCES product_keys(id) ON DELETE SET NULL;");
    await db("ALTER TABLE agent_enrollments ADD COLUMN IF NOT EXISTS activation_id TEXT REFERENCES device_activations(id) ON DELETE SET NULL;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS cpu_usage_percent INTEGER;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS memory_used_bytes BIGINT;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS memory_free_bytes BIGINT;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS device_manufacturer TEXT;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS device_model TEXT;");
    await db("ALTER TABLE agent_assets ADD COLUMN IF NOT EXISTS serial_number TEXT;");

    await db("CREATE INDEX IF NOT EXISTS idx_product_keys_active ON product_keys(active, expires_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_device_activations_key_status ON device_activations(product_key_id, status);");
    await db("CREATE INDEX IF NOT EXISTS idx_device_activations_last_seen ON device_activations(last_seen_at);");
    await db("CREATE INDEX IF NOT EXISTS idx_agent_enrollments_activation ON agent_enrollments(activation_id);");
  }
};

