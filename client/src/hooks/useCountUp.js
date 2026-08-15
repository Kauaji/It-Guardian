import { useEffect, useRef, useState } from "react";

/**
 * Smoothly interpolates a displayed number toward `target` whenever it changes,
 * continuing from wherever the animation currently is if interrupted mid-flight.
 * Falls back to an instant jump under prefers-reduced-motion.
 */
export function useCountUp(target, duration = 500) {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || currentRef.current === target) {
      currentRef.current = target;
      setDisplay(target);
      return undefined;
    }

    const from = currentRef.current;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (target - from) * eased);
      currentRef.current = value;
      setDisplay(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}
