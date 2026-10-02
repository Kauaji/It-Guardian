import { Monitor } from "lucide-react";

export default function EditorEmptyState() {
  return (
    <div className="floor-plan-empty-canvas">
      <Monitor size={24} aria-hidden="true" />
      <strong>Planta vazia</strong>
    </div>
  );
}
