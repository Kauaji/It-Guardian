import QRCode from "qrcode";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { labelPrintConfig } from "./labelPrintConfig.js";

function assetUrlFor(asset) {
  const baseUrl = (import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/$/, "");
  return `${baseUrl}/assets/${encodeURIComponent(asset.id)}`;
}

export default function BulkAssetLabelPrint({ assets = [], aliases = {}, onReadyToPrint }) {
  const [labels, setLabels] = useState([]);
  const readySent = useRef(false);

  const labelRequests = useMemo(
    () => assets.map((asset) => ({
      id: asset.id,
      name: aliases[asset.id] || asset.name,
      ip: asset.ip,
      assetTag: asset.hardware?.assetTag || asset.manualAsset?.assetTag || "Sem patrimonio",
      url: assetUrlFor(asset)
    })),
    [aliases, assets]
  );

  useEffect(() => {
    let cancelled = false;
    readySent.current = false;
    setLabels([]);

    Promise.all(
      labelRequests.map(async (item) => ({
        ...item,
        qrSrc: await QRCode.toDataURL(item.url, { margin: 1, width: 180 })
      }))
    ).then((nextLabels) => {
      if (!cancelled) setLabels(nextLabels);
    });

    return () => {
      cancelled = true;
    };
  }, [labelRequests]);

  useEffect(() => {
    if (!labels.length || readySent.current) return;
    readySent.current = true;
    onReadyToPrint?.();
  }, [labels, onReadyToPrint]);

  if (!assets.length || typeof document === "undefined") return null;

  return createPortal(
    <section
      className="zebra-label-print-view bulk-label-print-view"
      style={{
        "--label-width": `${labelPrintConfig.widthMm}mm`,
        "--label-height": `${labelPrintConfig.heightMm}mm`,
        "--label-qr-size": `${labelPrintConfig.qrSizeMm}mm`,
        "--label-padding": `${labelPrintConfig.paddingMm}mm`
      }}
      aria-hidden="true"
    >
      {labels.map((label) => (
        <article className="zebra-qr-label" key={label.id}>
          <img src={label.qrSrc} alt="" />
          <div>
            <h1>{label.name}</h1>
            <p>{label.assetTag}</p>
            <p>{label.ip}</p>
          </div>
        </article>
      ))}
    </section>,
    document.body
  );
}
