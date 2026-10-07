import { useState } from "react";
import { getDropDenial } from "../utils/dropRules.js";

// Arrastar OS entre colunas: destaque da coluna alvo e mudanca de status com checagem de permissao.
export function useOrderDragAndDrop({ serviceOrders, configuredStatuses, canChangeStatus, canFinishOrders, notify, onStatusChange }) {
  const [draggingOrderId, setDraggingOrderId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState("");

  function handleDragStart(event, order) {
    setDraggingOrderId(order.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", order.id);
  }

  function handleDragEnd() {
    setDraggingOrderId("");
    setDragOverStatus("");
  }

  async function handleDrop(event, targetStatus) {
    event.preventDefault();

    const orderId = event.dataTransfer.getData("text/plain") || draggingOrderId;
    const order = serviceOrders.find((item) => item.id === orderId);
    handleDragEnd();

    if (!order || order.status === targetStatus) return;
    const denial = getDropDenial({ targetStatus, configuredStatuses, canChangeStatus, canFinishOrders });
    if (denial) {
      notify?.(denial, "danger");
      return;
    }
    await onStatusChange(order, targetStatus);
  }

  function handleColumnDragOver(event, status) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  function handleColumnDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragOverStatus("");
    }
  }

  return { draggingOrderId, dragOverStatus, handleDragStart, handleDragEnd, handleDrop, handleColumnDragOver, handleColumnDragLeave };
}
