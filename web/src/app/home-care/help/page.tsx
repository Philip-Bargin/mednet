import type { Metadata } from "next";
import { HomeCareHelp } from "@/features/home-care/views";

export const metadata: Metadata = { title: "Help and guidance" };

export default function Page() {
  return <HomeCareHelp />;
}
