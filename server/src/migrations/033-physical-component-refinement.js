export const migration033PhysicalComponentRefinement = {
  id: "033-physical-component-refinement",
  async up(db) {
    await db(`
      UPDATE products
      SET active = FALSE,
          discrepancy_status = 'ok',
          discrepancy_details = '{}'::jsonb,
          updated_at = NOW()
      WHERE source = 'agent'
        AND active = TRUE
        AND (
          (
            metadata_json->>'hardwareType' = 'graphics'
            AND (
              lower(COALESCE(name, '')) LIKE '%radeon(tm) graphics%'
              OR lower(COALESCE(name, '')) = 'amd radeon graphics'
              OR lower(COALESCE(name, '')) LIKE 'intel%uhd%graphics%'
              OR lower(COALESCE(name, '')) LIKE 'intel%iris%graphics%'
              OR lower(COALESCE(name, '')) LIKE 'intel% hd%graphics%'
              OR lower(COALESCE(name, '')) LIKE '%vega % graphics%'
            )
          )
          OR lower(COALESCE(name, '')) LIKE '%hid keyboard device%'
          OR lower(COALESCE(name, '')) LIKE '%dispositivo de teclado hid%'
          OR lower(COALESCE(name, '')) LIKE '%hid mouse device%'
          OR lower(COALESCE(name, '')) LIKE '%dispositivo de mouse hid%'
          OR lower(COALESCE(name, '')) LIKE '%audio gateway service%'
          OR lower(COALESCE(name, '')) LIKE '%serviço de gateway de áudio%'
          OR lower(COALESCE(name, '')) LIKE '%servico de gateway de audio%'
          OR lower(COALESCE(name, '')) LIKE '%camera dfu%'
          OR lower(COALESCE(name, '')) LIKE '%firmware update%'
        );
    `);
    await db(`
      UPDATE products
      SET discrepancy_status = 'ok',
          discrepancy_details = '{}'::jsonb,
          updated_at = NOW()
      WHERE source = 'agent'
        AND discrepancy_status <> 'ok'
        AND metadata_json->>'hardwareType' IN ('mouse', 'keyboard', 'monitor', 'peripheral');
    `);
  }
};
