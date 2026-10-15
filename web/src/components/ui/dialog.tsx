"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * Reference: Dialog/Confirmation and Drawer/Detail (overlay elevation).
 *
 * Built on the native <dialog> element with showModal(): the browser provides the modal focus
 * trap, inert background, Escape to close and top-layer stacking — no extra dependency.
 *
 * - `onClose` fires once, only when the user dismisses (Escape, backdrop, close button) — not when
 *   the parent closes it by setting `open={false}`.
 * - Backdrop dismissal requires press *and* release on the backdrop, so dragging a text selection
 *   out of a field does not close the dialog.
 * - `initialFocus` chooses the element focused on open; focus returns to the opener on close.
 * - `dismissible={false}` blocks Escape and backdrop dismissal (e.g. while an action is saving).
 */
function useModalDialog({
  open,
  onClose,
  initialFocus,
  dismissible,
}: {
  open: boolean;
  onClose: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  dismissible: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closingFromProp = useRef(false);
  const pressedOnBackdrop = useRef(false);
  const dismissedByUser = useRef(false);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      initialFocus?.current?.focus();
    } else if (!open && dialog.open) {
      closingFromProp.current = true;
      dialog.close();
    }
  }, [open, initialFocus]);

  /**
   * A user dismissal (Escape, backdrop, close button) closes, returns focus and tells the parent in one
   * step. The native `close` event fires a task later, after the browser has already moved focus back to
   * the opener; waiting for it let a quick Enter on that opener land while the parent still thought the
   * dialog was open, so the reopen was silently lost (Phase 5E, keyboard.spec.ts).
   */
  const dismiss = useCallback(() => {
    const dialog = ref.current;
    if (!dialog?.open || !dismissibleRef.current) return;
    dismissedByUser.current = true;
    dialog.close();
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    flushSync(() => onCloseRef.current());
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClose() {
      if (dismissedByUser.current) {
        dismissedByUser.current = false;
        return;
      }
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      if (closingFromProp.current) {
        closingFromProp.current = false;
        return;
      }
      flushSync(() => onCloseRef.current());
    }
    function handleCancel(event: Event) {
      // Escape: close through `dismiss` so the parent hears about it synchronously.
      event.preventDefault();
      dismiss();
    }
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [dismiss]);

  const backdropHandlers = {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      pressedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const releasedOnBackdrop = event.target === event.currentTarget;
      if (pressedOnBackdrop.current && releasedOnBackdrop) dismiss();
      pressedOnBackdrop.current = false;
    },
  };

  return { ref, backdropHandlers, dismiss };
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocus,
  dismissible = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
  className?: string;
}) {
  const { ref, backdropHandlers, dismiss } = useModalDialog({ open, onClose, initialFocus, dismissible });
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      {...backdropHandlers}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-border bg-surface p-0 text-ink shadow-overlay backdrop:bg-green-950/40",
        className,
      )}
    >
      <div className="flex items-start gap-4 p-5 md:p-6">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-title text-ink">
            {title}
          </h2>
          {description ? (
            <p id={`${id}-description`} className="mt-1.5 text-data text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <CloseButton disabled={!dismissible} onClick={dismiss} />
      </div>
      {children ? <div className="px-5 pb-5 md:px-6 md:pb-6">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4 md:px-6">{footer}</div>
      ) : null}
    </dialog>
  );
}

/**
 * Confirmation for high-impact actions ("Account suspension … require confirmation"). Focus starts
 * on Cancel so Enter cannot confirm by accident; it cannot be dismissed while `loading`.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "default",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  tone?: "default" | "destructive";
  loading?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      initialFocus={cancelRef}
      dismissible={!loading}
      footer={
        <>
          <Button ref={cancelRef} variant="tertiary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === "destructive" ? "destructive" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/** Drawer/Detail: right-hand side sheet from 768px, full-width bottom sheet below. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const { ref, backdropHandlers, dismiss } = useModalDialog({ open, onClose, initialFocus, dismissible: true });
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      {...backdropHandlers}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-md border border-border bg-surface p-0 text-ink shadow-overlay backdrop:bg-green-950/40 md:mt-0 md:ml-auto md:h-dvh md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-md"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 border-b border-border px-5 py-4">
          <h2 id={`${id}-title`} className="min-w-0 flex-1 text-title text-ink">
            {title}
          </h2>
          <CloseButton onClick={dismiss} />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap gap-3 border-t border-border px-5 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}

function CloseButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Close"
      className="-m-1 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-soft hover:text-ink disabled:opacity-[0.42]"
    >
      <X aria-hidden size={20} strokeWidth={1.8} />
    </button>
  );
}
