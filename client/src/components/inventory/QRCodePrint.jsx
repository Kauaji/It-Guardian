import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AssetLabelPrint from "./AssetLabelPrint.jsx";

export default function QRCodePrint({ machine, alias }) {
  const [qrSrc, setQrSrc] = useState("");
  const [printingAssetId, setPrintingAssetId] = useState(null);
  const assetUrl = useMemo(() => {
    const baseUrl = (import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/$/, "");
    return `${baseUrl}/assets/${encodeURIComponent(machine.id)}`;
  }, [machine.id]);
  const assetTag = machine.hardware?.assetTag || machine.manualAsset?.assetTag || "";

  useEffect(() => {
    QRCode.toDataURL(assetUrl, { margin: 1, width: 180 })
      .then(setQrSrc)
      .catch(() => setQrSrc(""));
  }, [assetUrl]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("qr-print-mode");
      setPrintingAssetId(null);
    };
  }, []);

  function printAssetQRCode(assetId) {
    if (!qrSrc) return;

    function cleanup() {
      document.body.classList.remove("qr-print-mode");
      setPrintingAssetId(null);
      window.removeEventListener("afterprint", cleanup);
    }

    setPrintingAssetId(assetId);
    document.body.classList.add("qr-print-mode");
    window.addEventListener("afterprint", cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        window.setTimeout(cleanup, 1800);
      });
    });
  }

  return (
    <section className="qr-panel">
      <button type="button" className="ghost-action print-action" onClick={() => printAssetQRCode(machine.id)}>
        <Printer size={15} />
        Imprimir QR Code
      </button>
      {printingAssetId === machine.id && (
        <AssetLabelPrint
          qrSrc={qrSrc}
          name={alias || machine.name}
          assetTag={assetTag}
          ip={machine.ip}
        />
      )}
    </section>
  );
}
