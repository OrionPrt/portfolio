import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/admin/auth-card";
import { ADMIN_COPY } from "@/components/admin/copy";
import { LoginForm } from "@/components/admin/login-form";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { authConfig } from "@/features/auth/config";
import { getAdminSession } from "@/features/auth/dal";

export const metadata: Metadata = { title: ADMIN_COPY.login.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

export default async function LoginPage() {
  const session = await getAdminSession();
  if (session?.stage === "signed_in") {
    redirect(ADMIN_PATHS.home);
  }
  const isEnabled = authConfig().enabled;

  return (
    <AuthCard title={ADMIN_COPY.login.title} lead={ADMIN_COPY.login.lead}>
      {isEnabled ? <LoginForm /> : <p>{ADMIN_COPY.login.disabled}</p>}
    </AuthCard>
  );
}
