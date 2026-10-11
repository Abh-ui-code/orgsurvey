"use client";

import { useEffect, useState } from "react";

/** `value`, but only after it has stopped changing for `delayMs` -- so typing
 * in a search box doesn't fire a request per keystroke. */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
