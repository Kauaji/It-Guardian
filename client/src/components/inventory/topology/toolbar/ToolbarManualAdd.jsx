import NetworkTopologyAddAssetPicker from "../NetworkTopologyAddAssetPicker.jsx";
import NetworkTopologyAddClusterPicker from "../NetworkTopologyAddClusterPicker.jsx";

export default function ToolbarManualAdd({
  isClusterLevel,
  manualAddBusy,
  availableClustersToAdd,
  onAddCluster,
  availableDevicesToAdd,
  onAddAsset
}) {
  return (
    <fieldset className="network-topology-toolbar-row" disabled={manualAddBusy} style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}>
      {isClusterLevel ? (
        <NetworkTopologyAddClusterPicker items={availableClustersToAdd} onPick={onAddCluster} disabled={manualAddBusy} />
      ) : (
        <NetworkTopologyAddAssetPicker devices={availableDevicesToAdd} onPick={onAddAsset} disabled={manualAddBusy} />
      )}
    </fieldset>
  );
}
