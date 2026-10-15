import { cn } from "@/lib/cn";

/** Initials from a display name, ignoring honorifics ("Dr. Mariama Cole" → "MC"). */
export function initials(name: string): string {
  const parts = name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

const sizes = {
  sm: "size-8 text-[0.6875rem]",
  md: "size-10 text-caption",
  lg: "size-[3.125rem] text-data",
} as const;

/** Reference: circular identity avatar (brand-100 fill, brand-900 bold initials). Decorative. */
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-900",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
