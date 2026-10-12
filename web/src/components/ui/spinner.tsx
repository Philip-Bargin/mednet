import { cn } from "@/lib/cn";

/** Reference: circular loading indicator in the "Loading queue" state. Decorative unless labelled. */
export function Spinner({
  size = 16,
  label,
  className,
}: {
  size?: number;
  /** When set, the spinner is announced; otherwise it is hidden from assistive tech. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0", className)}
    >
      <span
        className="animate-spin rounded-full border-2 border-current border-r-transparent"
        style={{ width: size, height: size }}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
