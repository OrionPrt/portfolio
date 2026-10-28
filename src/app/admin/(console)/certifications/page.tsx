import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CertificationList } from "@/components/admin/content/certification-list";
import { ListIntro } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createCertificationsAdminRepository } from "@/features/catalog/certifications-admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.certifications.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.certifications;

export default async function CertificationsPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createCertificationsAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <ListIntro
        lead={COPY.lead}
        addHref={ADMIN_PATHS.newCertification}
        addLabel={COPY.add}
      />
      {loaded.ok ? (
        <CertificationList certifications={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
