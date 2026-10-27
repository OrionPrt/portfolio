import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProjectList } from "@/components/admin/content/project-list";
import { ADMIN_COPY } from "@/components/admin/copy";
import { BUTTON_CLASSES } from "@/components/ui/button-classes";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
        <Link href={ADMIN_PATHS.newProject} className={BUTTON_CLASSES.primary}>
          {COPY.add}
        </Link>
      </div>
      {loaded.ok ? (
        <ProjectList projects={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
