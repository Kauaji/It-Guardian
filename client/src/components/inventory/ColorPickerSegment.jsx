import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const colorOptions = ["#1f7a61", "#2563eb", "#7c3aed", "#d64545", "#d6a21f", "#475569"];

export default function ColorPickerSegment({ color, disabled, onChange }) {
  const currentColor = color || colorOptions[0];
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  function selectColor(nextColor) {
    onChange(nextColor);
    setOpen(false);
  }

  return (
    <div className="segment-color-picker" ref={pickerRef}>
      <button
        type="button"
        className="segment-color-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title="Alterar cor do segmento"
        aria-expanded={open}
        aria-label="Alterar cor do segmento"
      >
        <span style={{ backgroundColor: currentColor }} />
        <Palette size={15} />
      </button>

      {open && (
        <div className="segment-color-popover" aria-label="Cor do segmento">
          {colorOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={option.toLowerCase() === currentColor.toLowerCase() ? "active" : ""}
              style={{ backgroundColor: option }}
              disabled={disabled}
              onClick={() => selectColor(option)}
              title={`Usar cor ${option}`}
            />
          ))}
          <label className="custom-color" title="Escolher cor personalizada">
            <input
              type="color"
              value={currentColor}
              disabled={disabled}
              onChange={(event) => selectColor(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
