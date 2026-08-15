import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Digit({ char }) {
  const [rolling, setRolling] = useState(false);
  const prevRef = useRef(char);

  useEffect(() => {
    if (char === prevRef.current) return undefined;
    if (prefersReducedMotion()) {
      prevRef.current = char;
      return undefined;
    }
    setRolling(true);
    const timer = setTimeout(() => {
      prevRef.current = char;
      setRolling(false);
    }, 190);
    return () => clearTimeout(timer);
  }, [char]);

  if (rolling) {
    return (
      <span className="animated-number-digit rolling">
        <span className="animated-number-digit-track">
          <span>{prevRef.current}</span>
          <span>{char}</span>
        </span>
      </span>
    );
  }

  return <span className="animated-number-digit">{char}</span>;
}

/**
 * Renders a numeric/text value with a per-digit "odometer" roll whenever it changes.
 * Non-digit characters (%, /, letters) render statically. Falls back to an instant
 * swap under prefers-reduced-motion.
 */
export default function AnimatedNumber({ value, className = "" }) {
  const text = value === null || value === undefined || value === "" ? "--" : String(value);

  const chars = text.split("");

  return (
    <span className={`animated-number ${className}`.trim()}>
      <span aria-hidden="true" className="animated-number-visual">
        {chars.map((char, index) => {
          // Key by distance from the end (place value), not from the start, so a
          // digit keeps its identity across length changes (9 -> 10 rolls the ones
          // digit 9->0 and mounts a fresh tens digit "1", instead of misreading it
          // as the ones digit rolling 9->1).
          const placeKey = chars.length - 1 - index;
          return /[0-9]/.test(char) ? (
            <Digit key={placeKey} char={char} />
          ) : (
            <span key={placeKey} className="animated-number-static">{char}</span>
          );
        })}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
