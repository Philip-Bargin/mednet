"use client";

import { useId, useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * A control drawn in the reference but not available in a preview workspace. It stays focusable so
 * keyboard and screen-reader users can discover it, is marked aria-disabled, and on activation only
 * says that nothing happened. It never calls the API.
 */
export function PreviewAction({
  children,
  variant = "secondary",
  size,
  fullWidth,
  className,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}) {
  const id = useId();
  const [pressed, setPressed] = useState(false);
  return (
    <span className={cn("inline-flex flex-col gap-1", fullWidth && "flex w-full", className)}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        aria-disabled="true"
        aria-describedby={id}
        className="cursor-not-allowed"
        onClick={() => setPressed(true)}
      >
        {children}
      </Button>
      <span id={id} role="status" className="text-caption text-text-secondary">
        {pressed ? "Preview only: no action was taken." : <span className="sr-only">Not available in the preview.</span>}
      </span>
    </span>
  );
}
