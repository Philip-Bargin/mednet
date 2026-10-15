import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Reference: Icon button/Neutral/Medium (top-bar search and messages buttons).
 * 40×40 bordered square; an accessible name is required because the content is an icon.
 */
export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> & {
  label: string;
  icon: ReactNode;
  /** Shows the reference's small unread dot. */
  indicator?: boolean;
};

export function IconButton({
  label,
  icon,
  indicator = false,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-ink hover:border-control-border hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-[0.42]",
        className,
      )}
      {...props}
    >
      {icon}
      {indicator ? (
        <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-critical ring-2 ring-surface" />
      ) : null}
    </button>
  );
}
