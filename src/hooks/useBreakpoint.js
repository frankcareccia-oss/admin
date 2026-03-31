/**
 * useBreakpoint.js
 *
 * Returns current viewport tier.
 * Breakpoints:
 *   mobile  < 768px
 *   tablet  768px – 1023px
 *   desktop >= 1024px
 *
 * Uses a single resize listener with a 100ms debounce.
 * Components re-render only when the tier changes, not on every px.
 */

import { useState, useEffect } from "react";

const MOBILE_MAX  = 767;
const TABLET_MAX  = 1023;

function getTier(width) {
  if (width <= MOBILE_MAX)  return "mobile";
  if (width <= TABLET_MAX)  return "tablet";
  return "desktop";
}

export default function useBreakpoint() {
  const [tier, setTier] = useState(() => getTier(window.innerWidth));

  useEffect(() => {
    let timer;

    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = getTier(window.innerWidth);
        setTier((prev) => (prev === next ? prev : next));
      }, 100);
    }

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return {
    tier,
    isMobile:  tier === "mobile",
    isTablet:  tier === "tablet",
    isDesktop: tier === "desktop",
    /** true when tablet OR mobile — use for "not full desktop" layouts */
    isNarrow:  tier !== "desktop",
  };
}
