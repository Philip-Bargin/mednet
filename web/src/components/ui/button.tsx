import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

/**
 * Reference: Button/Primary, Button/Secondary, Button/Tertiary, Button/Destructive (Medium).
 * Measured: 44px min height, 20px inline padding, 15px bold label, 9px radius (normalised to the
 * approved 8px), 42% opacity when disabled. `inverse` is the white button on the dark green
 * welcome band ("Find a doctor").
 *
 * The phase brief's "outline" and "ghost" map to the reference's secondary and tertiary — no
 * duplicate variants are added.
 *
 * Fix for the reference's mobile clipping: height is a minimum, labels may wrap and are never cut.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "inverse";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex max-w-full items-center justify-center gap-2 rounded-sm border text-center text-button font-bold whitespace-normal transition-colors [overflow-wrap:anywhere] disabled:cursor-not-allowed disabled:opacity-[0.42] aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-action text-white shadow-card hover:bg-action-hover active:bg-green-900 disabled:hover:bg-action",
  secondary:
    "border-action-border bg-surface text-green-800 hover:border-action hover:bg-action-subtle active:bg-green-100 disabled:hover:bg-surface",
  tertiary:
    "border-transparent bg-transparent text-green-800 hover:bg-action-subtle active:bg-green-100 disabled:hover:bg-transparent",
  destructive:
    "border-critical-border bg-surface text-critical hover:border-critical hover:bg-critical-soft active:bg-critical-soft disabled:hover:bg-surface",
  inverse:
    "border-transparent bg-surface text-green-900 hover:bg-green-50 active:bg-green-100",
};

const sizes: Record<ButtonSize, string> = {
  /** 44×44 patient-facing minimum target. */
  md: "min-h-11 px-5 py-2",
  /** 40×40 professional minimum target. */
  sm: "min-h-10 px-4 py-1.5",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Icon before the label (decorative). */
  leadingIcon?: ReactNode;
  /** Icon after the label (decorative), e.g. an arrow. */
  trailingIcon?: ReactNode;
};

export type ButtonProps = ComponentProps<"button"> &
  CommonProps & {
    /** Shows a spinner, keeps the label for screen readers, and blocks repeat activation. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
      onClick={loading ? (event) => event.preventDefault() : props.onClick}
    >
      {loading ? <Spinner size={16} /> : leadingIcon}
      <span>{children}</span>
      {loading ? null : trailingIcon}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & CommonProps;

/** A link styled as a button — use for navigation; use `Button` for actions. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
