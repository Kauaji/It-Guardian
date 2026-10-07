import { buildServiceOrderNumberPreview } from "../../../serviceOrderBoardUtils.js";

// Prefixo, proximo numero, previa e uso de ano/mes no numero da OS.
export default function NumberFormatFields({ settings, updateField }) {
  const { numberFormat } = settings;
  return (
    <div className="service-order-number-settings">
      <label>
        Prefixo
        <input
          value={numberFormat.prefix}
          onChange={(event) => updateField("numberFormat", "prefix", event.target.value)}
          placeholder="OS"
        />
      </label>
      <label>
        Próximo número
        <input
          type="number"
          min="1"
          value={numberFormat.nextNumber || ""}
          onChange={(event) => updateField("numberFormat", "nextNumber", event.target.value)}
          placeholder="Automático"
        />
      </label>
      <div className="service-order-number-preview">
        <span>Prévia</span>
        <strong>{buildServiceOrderNumberPreview(settings)}</strong>
      </div>
      <label className="settings-inline-check">
        <input
          type="checkbox"
          checked={Boolean(numberFormat.useYear)}
          onChange={(event) => updateField("numberFormat", "useYear", event.target.checked)}
        />
        Usar ano no número
      </label>
      <label className="settings-inline-check">
        <input
          type="checkbox"
          checked={Boolean(numberFormat.useMonth)}
          onChange={(event) => updateField("numberFormat", "useMonth", event.target.checked)}
        />
        Usar mês no número
      </label>
    </div>
  );
}
