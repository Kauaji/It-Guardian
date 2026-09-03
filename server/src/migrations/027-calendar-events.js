export const migration027CalendarEvents = {
  id: "027-calendar-events",
  async up(db) {
    await db(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        event_type TEXT NOT NULL CHECK (event_type IN ('service_order', 'preventive_maintenance', 'technical_visit', 'internal_task', 'asset_check', 'reminder', 'other')),
        status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'missed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ,
        all_day BOOLEAN NOT NULL DEFAULT FALSE,
        service_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
        asset_id TEXT,
        technician_id TEXT REFERENCES technicians(id) ON DELETE SET NULL,
        segment_id TEXT REFERENCES inventory_segments(id) ON DELETE SET NULL,
        group_id TEXT REFERENCES segment_groups(id) ON DELETE SET NULL,
        environment_name TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        cancelled_at TIMESTAMPTZ,
        cancel_reason TEXT,
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (end_at IS NULL OR end_at > start_at)
      );
    `);
    await db(`CREATE INDEX IF NOT EXISTS idx_calendar_events_period ON calendar_events (start_at, end_at);`);
    await db(`CREATE INDEX IF NOT EXISTS idx_calendar_events_technician_period ON calendar_events (technician_id, start_at);`);
    await db(`CREATE INDEX IF NOT EXISTS idx_calendar_events_service_order ON calendar_events (service_order_id);`);
    await db(`CREATE INDEX IF NOT EXISTS idx_calendar_events_asset ON calendar_events (asset_id);`);
  }
};
