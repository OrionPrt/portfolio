import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { ProjectForm } from "@/components/admin/content/project-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { loadSkillOptions } from "@/features/catalog/skill-options";
import { createProjectAction } from "@/features/projects/admin-actions";
import { loadMediaOptions } from "@/features/media/media-options";

export const metadata: Metadata = { title: ADMIN_COPY.projects.newTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.projects;

export default async function NewProjectPage() {
  await requireAdmin();
  const [skills, media] = await Promise.all([
    withDatabase(loadSkillOptions),
    withDatabase(loadMediaOptions),
  ]);

  return (
    <>
      <AdminPageHeader title={COPY.newTitle} />
      <BackLink href={ADMIN_PATHS.projects} label={COPY.back} />
      {skills.ok && media.ok ? (
        <ProjectForm
          action={createProjectAction}
          skills={skills.data}
          media={media.data}
        />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
