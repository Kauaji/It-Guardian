import { assetTypeLabel } from "../../../inventory/assetTypes.js";
import { getDeviceContext } from "../utils/formModel.js";

function AssetPreview({ asset }) {
  const context = getDeviceContext(asset);
  return (
    <div className="service-order-asset-preview service-order-wide">
      <strong>{asset.name}</strong>
      <span>
        {asset.ip} - {assetTypeLabel(asset.assetType)}
        {context ? ` - ${context}` : ""}
      </span>
    </div>
  );
}

// Cliente (Business) ou aba do inventario (Local) e maquina/ativo vinculado.
export default function EnvironmentAssetFields({ form, businessMode, environmentLabel, clients, tabs, devices, selectedAsset, updateField }) {
  return (
    <>
      <label>
        {businessMode ? environmentLabel : "Aba do inventário (opcional)"}
        <select value={form.environmentId} onChange={(event) => updateField("environmentId", event.target.value)}>
          <option value="">{businessMode ? "Selecione um cliente" : "Usar a aba atual"}</option>
          {(businessMode ? clients : tabs).map((item) => (
            <option key={item.id} value={item.id}>
              {businessMode ? item.tradeName || item.legalName : item.name || "Novo ambiente"}
            </option>
          ))}
        </select>
        {!businessMode ? <small className="service-order-field-help">Define em qual aba do inventário a OS será contextualizada.</small> : null}
      </label>

      <label>
        Máquina/ativo{businessMode ? "" : " (quando possível)"}
        <select value={form.assetId} onChange={(event) => updateField("assetId", event.target.value)}>
          <option value="">Sem ativo vinculado</option>
          {devices.map((device) => {
            const context = getDeviceContext(device);
            return (
              <option key={device.id} value={device.id}>
                {device.name} - {device.ip}{context ? ` - ${context}` : ""}
              </option>
            );
          })}
        </select>
      </label>

      {selectedAsset && <AssetPreview asset={selectedAsset} />}
    </>
  );
}
