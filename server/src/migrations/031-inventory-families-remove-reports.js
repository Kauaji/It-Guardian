import { randomUUID } from "node:crypto";

const PHYSICAL_PART_CATEGORIES = [
  ["Placa de vídeo", "#db2777"],
  ["Fonte", "#d97706"],
  ["Mouse", "#9333ea"],
  ["Teclado", "#0284c7"],
  ["Monitor", "#059669"],
  ["Diversos", "#64748b"]
];

export const migration031InventoryFamiliesRemoveReports = {
  id: "031-inventory-families-remove-reports",
  async up(db) {
    for (const [name, color] of PHYSICAL_PART_CATEGORIES) {
      await db(
        `INSERT INTO part_categories (id, name, color)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [randomUUID(), name, color]
      );
    }

    await db(`
      UPDATE products
      SET active = FALSE, updated_at = NOW()
      WHERE source = 'agent'
        AND (
          lower(COALESCE(category, '')) = 'rede'
          OR lower(COALESCE(name, '')) LIKE '%virtual%'
          OR lower(COALESCE(name, '')) LIKE '%parsec%'
          OR lower(COALESCE(name, '')) LIKE '%driver%'
          OR lower(COALESCE(name, '')) LIKE '%controller%'
          OR lower(COALESCE(name, '')) LIKE '%controlador%'
        );
    `);

    await db(`UPDATE products SET category = 'Placa de vídeo', updated_at = NOW() WHERE active = TRUE AND lower(COALESCE(category, '')) = 'vídeo';`);
    await db(`UPDATE products SET category = 'Fonte', updated_at = NOW() WHERE active = TRUE AND (lower(COALESCE(category, '')) = 'energia' OR lower(COALESCE(name, '')) LIKE '%power supply%' OR lower(COALESCE(name, '')) LIKE '%fonte%');`);
    await db(`UPDATE products SET category = 'Mouse', updated_at = NOW() WHERE active = TRUE AND lower(COALESCE(name, '')) LIKE '%mouse%';`);
    await db(`UPDATE products SET category = 'Teclado', updated_at = NOW() WHERE active = TRUE AND (lower(COALESCE(name, '')) LIKE '%keyboard%' OR lower(COALESCE(name, '')) LIKE '%teclado%');`);
    await db(`UPDATE products SET category = 'Monitor', updated_at = NOW() WHERE active = TRUE AND lower(COALESCE(name, '')) LIKE '%monitor%';`);
    await db(`UPDATE products SET category = 'Diversos', updated_at = NOW() WHERE active = TRUE AND lower(COALESCE(category, '')) IN ('periféricos', 'outros');`);
    await db(`UPDATE part_categories SET active = FALSE, updated_at = NOW() WHERE lower(name) IN ('vídeo', 'rede', 'energia', 'periféricos', 'outros');`);

    await db("DROP TABLE IF EXISTS report_exports;");
  }
};
