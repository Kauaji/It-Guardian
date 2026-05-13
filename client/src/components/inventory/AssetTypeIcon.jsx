import {
  Camera,
  Computer,
  HardDrive,
  Laptop,
  Network,
  Printer,
  RadioTower,
  Router,
  Server,
  Wifi,
  Box
} from "lucide-react";

const iconMap = {
  server: Server,
  desktop: Computer,
  notebook: Laptop,
  printer: Printer,
  router: Router,
  switch: Network,
  access_point: Wifi,
  camera_ip: Camera,
  nas: HardDrive,
  other: Box
};

export default function AssetTypeIcon({ type, size = 16, ...props }) {
  const Icon = iconMap[type] || iconMap.other || RadioTower;
  return <Icon size={size} {...props} />;
}
