"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reference: Toast/Success ("✓ Administrator workspace opened" — dark brand surface, bottom right).
 * One polite live region announces each toast once (toasts themselves carry no live role, to avoid
 * double announcements). Dismissible; auto-hides after 6s unless hovered or focused. Dismissing
 * with the keyboard returns focus to where the user was before entering the toast.
 */
export type ToastMessage = { id: number; message: ReactNode };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);
  const show = useCallback((message: ReactNode) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message }]);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  return { toasts, show, dismiss };
}

export function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  /** Must be stable (e.g. `dismiss` from `useToasts`) so timers are not restarted on re-render. */
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 md:left-auto"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} id={toast.id} onDismiss={onDismiss}>
          {toast.message}
        </Toast>
      ))}
    </div>
  );
}

function Toast({ id, children, onDismiss }: { id: number; children: ReactNode; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(id), 6000);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss, id]);

  return (
    <div
      data-toast
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={(event) => {
        setPaused(true);
        const from = event.relatedTarget as HTMLElement | null;
        if (from && !event.currentTarget.contains(from)) returnFocus.current = from;
      }}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-sm bg-green-950 py-1.5 pr-1.5 pl-4 text-data font-bold text-white shadow-overlay"
    >
      <Check aria-hidden size={16} strokeWidth={2.2} className="shrink-0 text-green-100" />
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={() => {
          const target = returnFocus.current;
          onDismiss(id);
          if (target?.isConnected) target.focus();
        }}
        aria-label="Dismiss notification"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-green-100 hover:bg-white/10 focus-visible:outline-green-100"
      >
        <X aria-hidden size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}
