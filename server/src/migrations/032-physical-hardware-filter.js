export const migration032PhysicalHardwareFilter = {
  id: "032-physical-hardware-filter",
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
          lower(COALESCE(category, '')) = 'rede'
          OR lower(COALESCE(name, '')) LIKE '%hid-compliant%'
          OR lower(COALESCE(name, '')) LIKE '%compatível com hid%'
          OR lower(COALESCE(name, '')) LIKE '%compativel com hid%'
          OR lower(COALESCE(name, '')) LIKE '%usb input device%'
          OR lower(COALESCE(name, '')) LIKE '%dispositivo de entrada usb%'
          OR lower(COALESCE(name, '')) LIKE '%standard ps/2%'
          OR lower(COALESCE(name, '')) LIKE '%padrão ps/2%'
          OR lower(COALESCE(name, '')) LIKE '%padrao ps/2%'
          OR lower(COALESCE(name, '')) LIKE '%generic pnp monitor%'
          OR lower(COALESCE(name, '')) LIKE '%monitor pnp genérico%'
          OR lower(COALESCE(name, '')) LIKE '%monitor pnp generico%'
          OR lower(COALESCE(name, '')) LIKE '%microsoft basic display%'
          OR lower(COALESCE(name, '')) LIKE '%microsoft remote display%'
          OR lower(COALESCE(name, '')) LIKE '%storage space%'
          OR lower(COALESCE(name, '')) LIKE '%espaço de armazenamento%'
          OR lower(COALESCE(name, '')) LIKE '%espaco de armazenamento%'
          OR lower(COALESCE(name, '')) LIKE '%virtual disk%'
          OR lower(COALESCE(name, '')) LIKE '%disco virtual%'
          OR lower(COALESCE(name, '')) LIKE '%spacedesk%'
          OR lower(COALESCE(name, '')) LIKE '%citrix%'
          OR lower(COALESCE(name, '')) LIKE '%virtualbox%'
          OR lower(COALESCE(name, '')) LIKE '%vmware virtual%'
          OR lower(COALESCE(name, '')) LIKE '%qemu%'
        );
    `);
  }
};
