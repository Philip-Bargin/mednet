"use client";

import { useEffect, useState } from "react";

/** `value` once it has stopped changing for `delay` ms (search boxes that query the server). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * A zero-based page number that returns to the first page whenever `filterKey` changes, so a new
 * search or filter never opens on a page that no longer exists.
 */
export function usePageFor(filterKey: string): [number, (page: number) => void] {
  const [state, setState] = useState({ filterKey, page: 0 });
  const page = state.filterKey === filterKey ? state.page : 0;
  return [page, (next: number) => setState({ filterKey, page: Math.max(0, next) })];
}

/** Server pages hold at most this many rows (the API refuses more than 100). */
export const LIST_PAGE_SIZE = 25;
