"use client";

import { useCallback, useEffect, useState } from "react";
import type { Identity } from "./types";

const KEY = "demo-day-identity";
const EVENT = "demo-day-identity-change";

function read(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

/** Who is using this device. Stored in localStorage; there are no accounts. */
export function useIdentity() {
  const [identity, setIdentityState] = useState<Identity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setIdentityState(read());
    sync();
    setLoaded(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setIdentity = useCallback((next: Identity | null) => {
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { identity, setIdentity, loaded };
}
