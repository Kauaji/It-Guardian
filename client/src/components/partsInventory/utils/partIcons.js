import { Boxes, CircuitBoard, Cpu, HardDrive, Keyboard, MemoryStick, Monitor, MousePointer2, Zap } from "lucide-react";

const FAMILY_ICONS = {
  motherboard: CircuitBoard,
  processor: Cpu,
  graphics: Monitor,
  memory: MemoryStick,
  storage: HardDrive,
  power: Zap,
  mouse: MousePointer2,
  keyboard: Keyboard,
  monitor: Monitor,
  misc: Boxes
};

export function familyIcon(familyId) {
  return FAMILY_ICONS[familyId] || Boxes;
}
