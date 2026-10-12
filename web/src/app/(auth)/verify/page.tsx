import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { VerifyEmailPanel } from "@/features/auth/verify-email-panel";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <AuthShell
      eyebrow="Account verification"
      title="Confirm your email."
      description="We are checking the verification link from your email so you can sign in."
    >
      <VerifyEmailPanel />
    </AuthShell>
  );
}
