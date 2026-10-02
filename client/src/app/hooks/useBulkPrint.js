import { useEffect, useRef, useState } from "react";

const printBodyClasses = ["qr-print-mode", "bulk-qr-print-mode"];

// Impressao em lote das etiquetas QR: monta a area de impressao, chama
// window.print() quando o componente sinaliza que esta pronto e limpa tudo
// depois (afterprint ou timeout de seguranca).
export function useBulkPrint({ selectedAssets }) {
  const [bulkPrintAssets, setBulkPrintAssets] = useState([]);
  const cleanupTimer = useRef(null);
  const afterprintHandler = useRef(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(cleanupTimer.current);
      if (afterprintHandler.current) {
        window.removeEventListener("afterprint", afterprintHandler.current);
      }
      document.body.classList.remove(...printBodyClasses);
    };
  }, []);

  function finishBulkPrint() {
    document.body.classList.remove(...printBodyClasses);
    setBulkPrintAssets([]);
    window.clearTimeout(cleanupTimer.current);
    if (afterprintHandler.current) {
      window.removeEventListener("afterprint", afterprintHandler.current);
      afterprintHandler.current = null;
    }
  }

  function handleBulkPrint() {
    if (!selectedAssets.length) return;

    finishBulkPrint();
    setBulkPrintAssets(selectedAssets);
    document.body.classList.add(...printBodyClasses);
    afterprintHandler.current = finishBulkPrint;
    window.addEventListener("afterprint", afterprintHandler.current);
  }

  function handleBulkPrintReady() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        cleanupTimer.current = window.setTimeout(finishBulkPrint, 1800);
      });
    });
  }

  return { bulkPrintAssets, handleBulkPrint, handleBulkPrintReady };
}
