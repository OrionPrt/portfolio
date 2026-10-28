import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectList } from "@/components/admin/content/project-list";
import { ListIntro } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createProjectsAdminRepository } from "@/features/projects/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.projects.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.projects;

export default async function ProjectsPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createProjectsAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <ListIntro
        lead={COPY.lead}
        addHref={ADMIN_PATHS.newProject}
        addLabel={COPY.add}
      />
      {loaded.ok ? (
        <ProjectList projects={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
