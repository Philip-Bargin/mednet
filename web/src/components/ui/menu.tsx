"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonClasses, type ButtonVariant } from "./button";

/**
 * Reference: Menu/Action (e.g. "Escalate to… Administration / Finance"). WAI-ARIA menu button:
 * Enter/Space/ArrowDown open and focus the first item, arrows move, Escape closes and returns
 * focus to the trigger, Tab or an outside click closes.
 */
export type MenuItem = {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "default" | "critical";
};

export function Menu({
  label,
  items,
  variant = "secondary",
  align = "start",
}: {
  label: ReactNode;
  items: MenuItem[];
  variant?: ButtonVariant;
  align?: "start" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Disabled items stay focusable (aria-disabled) so they are discoverable, but cannot be activated.
  const enabled = items.map((_, index) => index);

  function focusItem(index: number | undefined) {
    if (index !== undefined) itemRefs.current[index]?.focus();
  }

  function openMenu(focus: "first" | "last") {
    setOpen(true);
    requestAnimationFrame(() => focusItem(focus === "first" ? enabled[0] : enabled.at(-1)));
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu("last");
    }
  }

  function onItemKeyDown(event: KeyboardEvent, index: number) {
    const position = enabled.indexOf(index);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(enabled[(position + 1) % enabled.length]);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(enabled[(position - 1 + enabled.length) % enabled.length]);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(enabled[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(enabled.at(-1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-trigger`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={onTriggerKeyDown}
        className={buttonClasses({ variant, size: "sm" })}
      >
        <span>{label}</span>
        <ChevronDown aria-hidden size={16} strokeWidth={1.8} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          id={`${id}-menu`}
          aria-labelledby={`${id}-trigger`}
          className={cn(
            "absolute z-30 mt-1.5 min-w-48 rounded-sm border border-border bg-surface p-1 shadow-overlay",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              onKeyDown={(event) => onItemKeyDown(event, index)}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                close(true);
              }}
              className={cn(
                "flex min-h-10 w-full items-center rounded-[6px] px-3 text-left text-data hover:bg-surface-soft focus-visible:bg-surface-soft aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42]",
                item.tone === "critical" ? "text-critical" : "text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
