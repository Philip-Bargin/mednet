import type { Metadata } from "next";
import { PermissionsMatrix } from "@/features/preview/views";

export const metadata: Metadata = { title: "Permissions matrix" };

export default function Page() {
  return <PermissionsMatrix />;
}
