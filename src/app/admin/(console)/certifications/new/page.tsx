import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { CertificationForm } from "@/components/admin/content/certification-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createCertificationAction } from "@/features/catalog/certifications-admin-actions";
import { loadMediaOptions } from "@/features/media/media-options";

export const metadata: Metadata = { title: ADMIN_COPY.certifications.newTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.certifications;

export default async function NewCertificationPage() {
  await requireAdmin();
  const media = await withDatabase(loadMediaOptions);

  return (
    <>
      <AdminPageHeader title={COPY.newTitle} />
      <BackLink href={ADMIN_PATHS.certifications} label={COPY.back} />
      {media.ok ? (
        <CertificationForm
          action={createCertificationAction}
          media={media.data}
        />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
