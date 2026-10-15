"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { RestrictedNotice } from "@/components/ui/lists";
import { cn } from "@/lib/cn";

/**
 * Operations-workspace building blocks shared by the administrative (4E) and laboratory (4F)
 * workspaces: page heading, list card, selectable rows and the "Selected record" panel.
 */
/**
 * Reference: the operations sub-view heading ("LABORATORY PARTNER · Order operations · Review assigned
 * orders…", "SUPER ADMINISTRATOR · Users and roles · …") with a primary action at the right, drawn on
 * the canvas rather than in a dark band.
 */
export function OperationsPageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-3xl">
        <Eyebrow tone="action">{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-h2 font-normal tracking-[-0.02em] text-green-950 md:text-[2rem] md:leading-[2.75rem]">{title}</h2>
        <p className="mt-2 text-body text-text-secondary">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}

/**
 * Reference: list card + "SELECTED RECORD" card. The record card sits beside the list from 1200px
 * and below it on smaller screens, where choosing a row moves focus to the record heading.
 */
export function RecordLayout({ list, record }: { list: ReactNode; record: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">{list}</div>
      <div className="min-w-0 lg:sticky lg:top-6">{record}</div>
    </div>
  );
}

/**
 * The selected-record panel. When a record is chosen (the panel appears or `focusKey` changes), the
 * heading receives focus, and so scrolls into view, so keyboard, screen-reader and small-screen users land
 * on the details they asked for. Nothing moves on page load, when focus is still on the page body.
 */
export function SelectedRecord({
  reference,
  title,
  children,
  actions,
  restricted,
  focusKey,
}: {
  reference: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  restricted?: ReactNode;
  focusKey?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Callers remount the panel per record (`key`), so this runs on every choice. Before Phase 5E it
    // skipped the first run, which in production builds meant focus never moved (development's double
    // effects hid it).
    const active = document.activeElement;
    if (focusKey && active && active !== document.body) heading.current?.focus();
  }, [focusKey]);

  return (
    <Card aria-label="Selected record">
      <Eyebrow>Selected record</Eyebrow>
      <h3 ref={heading} tabIndex={-1} className="mt-1.5 text-title font-normal text-ink [overflow-wrap:anywhere] focus:outline-none focus-visible:outline-3">
        {reference}
      </h3>
      {title ? <p className="mt-1 text-data text-text-secondary [overflow-wrap:anywhere]">{title}</p> : null}
      {children ? <div className="mt-5 flex flex-col gap-5">{children}</div> : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
      {restricted ? <div className="mt-5"><RestrictedNotice>{restricted}</RestrictedNotice></div> : null}
    </Card>
  );
}

/** Placeholder for the record panel before anything is chosen. */
export function NoRecordSelected({ children }: { children: ReactNode }) {
  return (
    <Card aria-label="Selected record">
      <Eyebrow>Selected record</Eyebrow>
      <p className="mt-3 text-data text-text-secondary">{children}</p>
    </Card>
  );
}

/** List card with the reference's submenu eyebrow ("SUPER ADMINISTRATOR SUBMENU · Users and roles"). */
export function ListCard({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-5", className)}>
      <CardHeader eyebrow={eyebrow} title={title} action={action} />
      {children}
    </Card>
  );
}

/** A row button for selectable lists: whole row is one control, selection is not colour alone. */
export function SelectableRow({
  selected,
  onSelect,
  marker,
  title,
  meta,
  trailing,
}: {
  selected: boolean;
  onSelect: () => void;
  marker?: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-sm px-2 py-3 text-left hover:bg-surface-soft",
          selected && "bg-green-50 shadow-[inset_3px_0_0_var(--color-action)] hover:bg-green-50",
        )}
      >
        {marker ? (
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-soft text-[0.6875rem] font-bold text-green-800">
            {marker}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink [overflow-wrap:anywhere]">{title}</span>
          {meta ? <span className="block text-caption text-text-secondary [overflow-wrap:anywhere]">{meta}</span> : null}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </button>
    </li>
  );
}

export function SelectableList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-line-soft">
      {children}
    </ul>
  );
}

/** "12 Oct 2026, 09:42" in Liberia time (GMT). */
export function formatOperationsDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Monrovia",
  }).format(new Date(value));
}

export function formatOperationsTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Monrovia" }).format(new Date(value));
}
