import {
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  Printer,
  ScanLine,
  Webcam
} from "lucide-react";

const iconByType = {
  Monitor,
  Mouse,
  Teclado: Keyboard,
  Headset: Headphones,
  Impressora: Printer,
  Webcam,
  Dockstation: HardDrive,
  Notebook: Laptop,
  Scanner: ScanLine
};

export default function PeripheralItem({ peripheral }) {
  const Icon = iconByType[peripheral.type] || Package;

  return (
    <li className="peripheral-item">
      <Icon size={15} />
      <span>{peripheral.type}</span>
      <strong>{peripheral.brand || "Sem marca"}</strong>
      <em>{peripheral.assetTag || "Sem patrimonio"}</em>
    </li>
  );
}
