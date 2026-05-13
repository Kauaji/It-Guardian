import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import PeripheralItem from "./PeripheralItem.jsx";

const peripheralTypes = [
  "Monitor",
  "Mouse",
  "Teclado",
  "Headset",
  "Impressora",
  "Webcam",
  "Dockstation",
  "Notebook",
  "Scanner",
  "Outro"
];

export default function PeripheralList({ peripherals = [], segmentColor }) {
  const [items, setItems] = useState(peripherals);
  const [draft, setDraft] = useState({
    type: "Monitor",
    customType: "",
    brand: "",
    assetTag: ""
  });

  useEffect(() => {
    setItems(peripherals);
  }, [peripherals]);

  function addPeripheral(event) {
    event.preventDefault();
    const type = draft.type === "Outro" ? draft.customType.trim() : draft.type;
    if (!type) return;

    setItems((current) => [
      ...current,
      {
        id: `${type}-${draft.brand}-${draft.assetTag}-${Date.now()}`,
        type,
        brand: draft.brand.trim(),
        assetTag: draft.assetTag.trim()
      }
    ]);
    setDraft({ type: "Monitor", customType: "", brand: "", assetTag: "" });
  }

  return (
    <section className="peripheral-panel" style={{ "--machine-segment-color": segmentColor || "#1f7a61" }}>
      <header>
        <span>Perifericos</span>
        <strong>{items.length}</strong>
      </header>

      <ul className="peripheral-list">
        {items.map((peripheral) => (
          <PeripheralItem key={peripheral.id || `${peripheral.type}-${peripheral.assetTag}`} peripheral={peripheral} />
        ))}
        {!items.length && <li className="peripheral-empty">Nenhum periferico vinculado.</li>}
      </ul>

      <form className="peripheral-add-form" onSubmit={addPeripheral}>
        <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
          {peripheralTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        {draft.type === "Outro" && (
          <input
            value={draft.customType}
            onChange={(event) => setDraft({ ...draft, customType: event.target.value })}
            placeholder="Tipo"
          />
        )}
        <input
          value={draft.brand}
          onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
          placeholder="Marca"
        />
        <input
          value={draft.assetTag}
          onChange={(event) => setDraft({ ...draft, assetTag: event.target.value })}
          placeholder="Patrimonio"
        />
        <button type="submit" title="Adicionar periferico">
          <Plus size={14} />
        </button>
      </form>
    </section>
  );
}
