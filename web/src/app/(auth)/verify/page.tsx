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
      description="Enter the six-digit code from your email, or use its secure verification link instead."
    >
      <VerifyEmailPanel />
    </AuthShell>
  );
}
