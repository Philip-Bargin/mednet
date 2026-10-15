import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { SignInPanel } from "@/features/auth/sign-in-panel";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const googleError = params.error === "google";
  return (
    <AuthShell
      eyebrow="Secure access"
      title="Sign in securely."
      description="Use your email and password or continue with Google. New accounts start with patient access; provider access requires approval."
    >
      <SignInPanel googleError={googleError} />
    </AuthShell>
  );
}
