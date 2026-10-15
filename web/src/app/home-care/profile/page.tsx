import type { Metadata } from "next";
import { HomeCareProfile } from "@/features/home-care/views";

export const metadata: Metadata = { title: "Your account" };

export default function Page() {
  return <HomeCareProfile />;
}
