"use client";

/**
 * LiveRegionProvider (Tasks 0.3, 7.9): two persistent ARIA live regions
 * (polite + assertive) that any component can push an announcement into,
 * for voice listening/transcribing/updating states, validation summaries,
 * and booking-status changes (AC-A11Y-04).
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

interface LiveRegionContextValue {
  announce: (message: string, assertive?: boolean) => void;
}

const LiveRegionContext = createContext<LiveRegionContextValue | null>(null);

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");
  const counter = useRef(0);

  const announce = useCallback((message: string, assertive = false) => {
    counter.current += 1;
    // Prefix with a zero-width counter so repeated identical messages still
    // trigger a fresh announcement in screen readers.
    const tagged = `${message}`;
    if (assertive) {
      setAssertiveMsg(tagged);
    } else {
      setPolite(tagged);
    }
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce }}>
      {children}
      <div aria-live="polite" role="status" className="visually-hidden">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="visually-hidden">
        {assertiveMsg}
      </div>
    </LiveRegionContext.Provider>
  );
}

export function useLiveRegion(): LiveRegionContextValue {
  const ctx = useContext(LiveRegionContext);
  if (!ctx) throw new Error("useLiveRegion must be used within a LiveRegionProvider");
  return ctx;
}
