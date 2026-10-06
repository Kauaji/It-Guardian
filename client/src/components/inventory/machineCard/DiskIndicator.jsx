import { HardDrive } from "lucide-react";
import { metricTone } from "./machineCardPresentation.js";

export default function DiskIndicator({ value }) {
  if (value == null) return null;
  return (
    <span className={`disk-indicator ${metricTone(value)}`} title={`Disco ${value}%`}>
      <HardDrive size={12} />
      {value}%
    </span>
  );
}
