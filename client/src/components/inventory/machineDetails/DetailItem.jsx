import { formatHardwareValue } from "../hardwarePresentation.js";

export default function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{formatHardwareValue(value)}</strong>
    </div>
  );
}
