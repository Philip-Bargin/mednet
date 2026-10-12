import type { Metadata } from "next";
import { AccountPanel } from "@/features/auth/account-panel";
import { AuthShell } from "@/features/auth/auth-shell";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <AuthShell
      eyebrow="Personal access"
      title="Your MedNet account."
      description="Account details for your current session. Protected health information is never shown on this page."
    >
      <AccountPanel />
    </AuthShell>
  );
}
