import { useEffect, useState } from "react";

const SETTLE_DELAY_MS = 200;

/**
 * Recharts' ResponsiveContainer relies on ResizeObserver to re-measure and
 * re-clone its chart child on resize. With several ResponsiveContainer
 * instances observing at once (one per dashboard chart card), the browser
 * can skip a notification for some of them during a burst of resize events
 * (window drag), leaving that chart rendered at a stale width forever until
 * the next resize happens to touch it again. Remounting the container once
 * the resize has settled sidesteps the missed-notification case entirely:
 * a fresh mount always measures the final size correctly.
 */
export function useSettledWidthKey() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setKey((value) => value + 1), SETTLE_DELAY_MS);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return key;
}
