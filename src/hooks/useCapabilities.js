/**
 * useCapabilities.js — Feature capability hook
 *
 * Fetches merchant capabilities once per mount and caches in memory.
 * Components use this to conditionally show/hide features based on teamSetupMode.
 *
 * Usage:
 *   const { caps, loading } = useCapabilities();
 *   if (caps?.features?.associateLeaderboard) { ... }
 */

import { useState, useEffect } from "react";
import { merchantGetCapabilities } from "../api/client";

let _cache = null;
let _fetching = false;
let _listeners = [];

function notify() {
  _listeners.forEach((fn) => fn({ ..._cache }));
}

export default function useCapabilities() {
  const [caps, setCaps] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setCaps(_cache);
      setLoading(false);
      return;
    }

    _listeners.push(onUpdate);

    if (!_fetching) {
      _fetching = true;
      merchantGetCapabilities()
        .then((data) => {
          _cache = data;
          notify();
        })
        .catch((err) => {
          console.warn("[useCapabilities] fetch failed:", err?.message);
          _cache = { mode: null, configured: false, features: {}, error: true };
          notify();
        })
        .finally(() => { _fetching = false; });
    }

    function onUpdate(data) {
      setCaps(data);
      setLoading(false);
    }

    return () => {
      _listeners = _listeners.filter((fn) => fn !== onUpdate);
    };
  }, []);

  return { caps, loading };
}

/** Clear cache (e.g. after merchant updates teamSetupMode) */
export function clearCapabilitiesCache() {
  _cache = null;
}
