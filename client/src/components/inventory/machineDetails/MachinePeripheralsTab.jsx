import AssetTypeIcon from "../AssetTypeIcon.jsx";
import PeripheralList from "../PeripheralList.jsx";

export default function MachinePeripheralsTab({ model, segmentColor, canManage, onAddPeripheral, onRemovePeripheral }) {
  const { machine, hardware, isManualAsset } = model;
  return (
    <section className="asset-tab-content">
      {isManualAsset ? (
        <div className="network-card">
          <AssetTypeIcon type={machine.assetType} size={18} />
          <span>Ativos de rede não são periféricos USB. Eles possuem IP próprio e aparecem como itens independentes.</span>
        </div>
      ) : (
        <PeripheralList
          peripherals={hardware.peripherals || []}
          segmentColor={segmentColor}
          canManage={canManage}
          allowAdd={canManage}
          onAdd={onAddPeripheral}
          onRemove={onRemovePeripheral}
        />
      )}
    </section>
  );
}
