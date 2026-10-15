import type { Metadata } from "next";
import { ProviderProfile } from "@/features/provider/application";

export const metadata: Metadata = { title: "Your profile" };

export default function Page() {
  return <ProviderProfile />;
}
