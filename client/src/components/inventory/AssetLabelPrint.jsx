import { createPortal } from "react-dom";
import { labelPrintConfig } from "./labelPrintConfig.js";

export default function AssetLabelPrint({ qrSrc, name, assetTag, ip }) {
  if (!qrSrc || typeof document === "undefined") return null;

  return createPortal(
    <section
      className="zebra-label-print-view"
      style={{
        "--label-width": `${labelPrintConfig.widthMm}mm`,
        "--label-height": `${labelPrintConfig.heightMm}mm`,
        "--label-qr-size": `${labelPrintConfig.qrSizeMm}mm`,
        "--label-padding": `${labelPrintConfig.paddingMm}mm`
      }}
      aria-hidden="true"
    >
      <article className="zebra-qr-label">
        <img src={qrSrc} alt="" />
        <div>
          <h1>{name}</h1>
          <p>{assetTag || "Sem patrimonio"}</p>
          <p>{ip}</p>
        </div>
      </article>
    </section>,
    document.body
  );
}
