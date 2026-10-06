import MachineCard from "../MachineCard.jsx";

export default function SegmentMachineGrid({ machines, color, selectedAssetIds, aliases, cardProps }) {
  return (
    <div className="segment-machine-grid">
      {machines.map((machine) => (
        <MachineCard
          key={machine.id}
          machine={machine}
          segmentColor={color}
          alias={aliases[machine.id]}
          selected={selectedAssetIds.has(machine.id)}
          {...cardProps}
        />
      ))}
      {!machines.length && (
        <div className="empty-segment wide-empty">
          <span>Solte máquinas aqui</span>
        </div>
      )}
    </div>
  );
}
