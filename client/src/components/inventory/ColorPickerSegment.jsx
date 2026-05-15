import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const colorOptions = ["#1f7a61", "#2563eb", "#7c3aed", "#d64545", "#d6a21f", "#475569"];

export default function ColorPickerSegment({
  color,
  disabled,
  onChange,
  popoverId,
  activePopoverId,
  setActivePopoverId,
  title = "Alterar cor do segmento"
}) {
  const currentColor = color || colorOptions[0];
  const [localOpen, setLocalOpen] = useState(false);
  const pickerRef = useRef(null);
  const controlled = Boolean(popoverId && setActivePopoverId);
  const open = controlled ? activePopoverId === popoverId : localOpen;

  function setPickerOpen(nextOpen) {
    if (controlled) {
      setActivePopoverId(nextOpen ? popoverId : null);
    } else {
      setLocalOpen(nextOpen);
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (disabled && open) setPickerOpen(false);
  }, [disabled, open]);

  function selectColor(nextColor) {
    onChange(nextColor);
    setPickerOpen(false);
  }

  return (
    <div
      className="segment-color-picker"
      ref={pickerRef}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPickerOpen(false);
      }}
    >
      <button
        type="button"
        className="segment-color-trigger"
        disabled={disabled}
        onClick={() => setPickerOpen(!open)}
        title={title}
        aria-expanded={open}
        aria-label={title}
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
