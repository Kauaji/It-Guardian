import { useState } from "react";

// Estado do modal "Mover para...": máquina em edição e segmento escolhido.
export function useMoveModal() {
  const [moveModal, setMoveModal] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");

  function openMoveModal(machine, targetSegmentId = machine.segmentId) {
    setMoveModal(machine);
    setMoveTarget(targetSegmentId);
  }

  function closeMoveModal() {
    setMoveModal(null);
  }

  return { moveModal, setMoveModal, moveTarget, setMoveTarget, openMoveModal, closeMoveModal };
}
