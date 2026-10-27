import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ExperienceList } from "@/components/admin/content/experience-list";
import { ADMIN_COPY } from "@/components/admin/copy";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createExperiencesAdminRepository } from "@/features/experiences/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.experiences.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.experiences;

export default async function ExperiencesPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createExperiencesAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
        <Link
          href={ADMIN_PATHS.newExperience}
          className={BUTTON_CLASSES.primary}
        >
          {COPY.add}
        </Link>
      </div>
      {loaded.ok ? (
        <ExperienceList experiences={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
