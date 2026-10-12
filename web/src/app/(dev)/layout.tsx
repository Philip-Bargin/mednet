import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Foundation preview",
  robots: { index: false, follow: false },
};

/** Development-only routes for reviewing the design foundation. Not served in production. */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
