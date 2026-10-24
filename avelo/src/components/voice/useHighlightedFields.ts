"use client";

import { useEffect, useState } from "react";
import type { FieldPath } from "@/domain/types";

const HIGHLIGHT_DURATION_MS = 4000;

/** Briefly highlights fields changed by the latest voice/typed patch, then clears. */
export function useHighlightedFields(lastChangedFields: FieldPath[]): Set<FieldPath> {
  const [highlighted, setHighlighted] = useState<Set<FieldPath>>(new Set());

  useEffect(() => {
    if (lastChangedFields.length === 0) return;
    // Synchronizing local highlight state with an external prop change
    // (the latest merge result) plus a cleanup timer -- a standard,
    // intentional use of an effect, not a derivable-during-render value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlighted(new Set(lastChangedFields));
    const timer = setTimeout(() => setHighlighted(new Set()), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [lastChangedFields]);

  return highlighted;
}
