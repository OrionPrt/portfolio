import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { EducationForm } from "@/components/admin/content/education-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createEducationAction } from "@/features/catalog/education-admin-actions";

export const metadata: Metadata = { title: ADMIN_COPY.education.newTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.education;

export default async function NewEducationPage() {
  await requireAdmin();

  return (
    <>
      <AdminPageHeader title={COPY.newTitle} />
      <BackLink href={ADMIN_PATHS.education} label={COPY.back} />
      <EducationForm action={createEducationAction} />
    </>
  );
}
