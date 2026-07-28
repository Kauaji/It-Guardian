export const migration006RemoveDemoInventory = {
  id: "006-remove-demo-inventory",
  async up(db) {
    const demoAssetIds = [
      "manual-printer-rh",
      "manual-printer-financeiro",
      "manual-printer-expedicao",
      "manual-switch-acesso-01",
      "manual-switch-acesso-02",
      "manual-ap-recepcao",
      "manual-ap-financeiro",
      "manual-ap-estoque",
      "manual-nas-arquivos-01",
      "manual-router-link-02",
      "manual-camera-galpao",
      "manual-camera-recepcao-01",
      "manual-camera-caixa-01"
    ];
    const placeholders = demoAssetIds.map((_, index) => `$${index + 1}`).join(", ");

    await db(`DELETE FROM device_segments WHERE device_id IN (${placeholders})`, demoAssetIds);
    await db(`DELETE FROM device_metadata WHERE device_id IN (${placeholders})`, demoAssetIds);
    await db(`DELETE FROM asset_history WHERE asset_id IN (${placeholders})`, demoAssetIds);
    await db(`DELETE FROM manual_network_assets WHERE id IN (${placeholders})`, demoAssetIds);
  }
};
