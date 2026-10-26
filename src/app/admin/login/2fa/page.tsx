import type { Metadata } from "next";

import { AuthCard } from "@/components/admin/auth-card";
import { ADMIN_COPY } from "@/components/admin/copy";
import { SecondFactorForm } from "@/components/admin/second-factor-form";
import { requireLoginStep } from "@/features/auth/dal";

export const metadata: Metadata = { title: ADMIN_COPY.secondFactor.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

export default async function SecondFactorPage() {
  await requireLoginStep("totp_challenge");

  return (
    <AuthCard titleId="admin-2fa-title" title={ADMIN_COPY.secondFactor.title}>
      <SecondFactorForm />
    </AuthCard>
  );
}
