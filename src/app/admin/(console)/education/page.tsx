import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EducationList } from "@/components/admin/content/education-list";
import { ListIntro } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createEducationAdminRepository } from "@/features/catalog/education-admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.education.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.education;

export default async function EducationPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createEducationAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <ListIntro
        lead={COPY.lead}
        addHref={ADMIN_PATHS.newEducation}
        addLabel={COPY.add}
      />
      {loaded.ok ? (
        <EducationList entries={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
