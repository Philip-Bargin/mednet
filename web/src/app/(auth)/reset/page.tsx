import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordPanel } from "@/features/auth/reset-password-panel";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  return (
    <AuthShell
      eyebrow="Account security"
      title="Reset your password."
      description="We email a one-time six-digit code to confirm it is you, then you choose a new password."
    >
      <ResetPasswordPanel initialEmail={email} />
    </AuthShell>
  );
}
