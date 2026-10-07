import { useState } from "react";
import { buildPrintDocument } from "../utils/printDocument.js";
import { buildDeleteMessage, resolveSectorUpdate } from "../utils/orderLookups.js";

const PRINT_DELAY_MS = 250;

// Acoes da OS no detalhe: salvar atendimento, setor, reabrir, excluir e imprimir.
export function useServiceOrderActions({
  serviceOrder,
  draft,
  asset,
  businessMode,
  environmentLabel,
  statusLabelMap,
  availableSectors,
  finance,
  notify,
  onUpdate,
  onReopen,
  onDelete,
  onClose
}) {
  const [reopening, setReopening] = useState(false);

  function submitAttendance(event) {
    event.preventDefault();
    const { serviceItems, serviceValueNumber, partsTotal, totalValue } = finance;
    onUpdate(serviceOrder.id, {
      ...draft,
      serviceValue: businessMode ? serviceValueNumber : 0,
      items: serviceItems,
      totalPartsValue: businessMode ? partsTotal : 0,
      totalValue: businessMode ? totalValue : 0
    });
  }

  function printServiceOrder() {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      notify?.("Não foi possível abrir a janela de impressão.", "danger");
      return;
    }

    popup.document.write(
      buildPrintDocument({
        serviceOrder,
        draft,
        asset,
        statusLabelMap,
        environmentLabel,
        businessMode,
        ...finance
      })
    );
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), PRINT_DELAY_MS);
  }

  async function changeServiceOrderSector(sectorId) {
    await onUpdate(serviceOrder.id, resolveSectorUpdate(availableSectors, sectorId));
  }

  async function reopenOrder() {
    const reason = window.prompt("Motivo da reabertura desta Ordem de Serviço:");
    if (reason == null) return;
    if (!reason.trim()) {
      notify?.("Informe o motivo da reabertura.", "danger");
      return;
    }

    setReopening(true);
    try {
      const updated = await onReopen?.(serviceOrder.id, reason.trim());
      if (updated) notify?.("Ordem de Serviço reaberta.", "ok");
    } finally {
      setReopening(false);
    }
  }

  async function deleteOrder() {
    if (!window.confirm(buildDeleteMessage(serviceOrder))) return;

    const deleted = await onDelete?.(serviceOrder);
    if (deleted) onClose();
  }

  return { reopening, submitAttendance, printServiceOrder, changeServiceOrderSector, reopenOrder, deleteOrder };
}
