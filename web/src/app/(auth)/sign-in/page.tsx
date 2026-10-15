import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { SignInPanel } from "@/features/auth/sign-in-panel";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Secure access"
      title="Sign in securely."
      description="Sign in with your MedNet account or create a new account. New accounts start with patient access; provider access requires approval."
    >
      <SignInPanel />
    </AuthShell>
  );
}
