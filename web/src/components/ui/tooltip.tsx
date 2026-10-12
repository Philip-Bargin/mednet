"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Contextual help ("Rate not displayed", "Defined by transaction rule"). Not drawn in the
 * reference — interpretation: an info button that reveals a short description.
 *
 * - Opens on hover, keyboard focus, or tap/click (click only opens; it never toggles closed, so
 *   focus-then-click on touch keeps it visible).
 * - WCAG 1.4.13: dismissible with Escape from anywhere while open, hoverable (the gap to the
 *   bubble is bridged with padding), and persistent until pointer/focus leaves.
 * - The description is always linked with aria-describedby, so screen readers get it on focus.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** Accessible name of the trigger, e.g. "About platform fees". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!(event.target as Element).closest?.(`[data-infotip="${CSS.escape(id)}"]`)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, id]);

  return (
    <span
      data-infotip={id}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="-m-2 inline-flex size-10 items-center justify-center rounded-full text-text-secondary hover:text-action"
      >
        <Info aria-hidden size={16} strokeWidth={1.8} />
      </button>
      {/* pb-2 bridges the gap so moving the pointer onto the bubble keeps it open. */}
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className="absolute bottom-full left-1/2 z-30 block w-max max-w-64 -translate-x-1/2 pb-2"
      >
        <span className="block rounded-sm bg-green-950 px-3 py-2 text-caption text-white shadow-overlay">{children}</span>
      </span>
    </span>
  );
}
