import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { ProjectForm } from "@/components/admin/content/project-form";
import { EntryMissing } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { loadSkillOptions } from "@/features/catalog/skill-options";
import {
  deleteProjectAction,
  updateProjectAction,
} from "@/features/projects/admin-actions";
import { createProjectsAdminRepository } from "@/features/projects/admin-repository";
import { loadMediaOptions } from "@/features/media/media-options";

export const metadata: Metadata = { title: ADMIN_COPY.projects.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.projects;

export default async function EditProjectPage({
  params,
}: PageProps<"/admin/projects/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [found, skills, media] = await Promise.all([
    withDatabase((db) => createProjectsAdminRepository(db).find(id)),
    withDatabase(loadSkillOptions),
    withDatabase(loadMediaOptions),
  ]);
  const project = found.ok ? found.data : undefined;
  const isAvailable = found.ok && skills.ok && media.ok;
  const title =
    project === undefined
      ? ""
      : (project.translations.fr?.title ?? project.slug);

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.projects} label={COPY.back} />
      {project !== undefined && skills.ok && media.ok ? (
        <>
          {/* Keyed: another project's page keeps its own form state. */}
          <ProjectForm
            key={project.id}
            action={updateProjectAction}
            project={project}
            skills={skills.data}
            media={media.data}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deleteProjectAction}
              id={project.id}
              label={title}
              title={COPY.deleteTitle(title)}
              afterDelete={ADMIN_PATHS.projects}
              consequence={ADMIN_COPY.entries.deleteConsequence}
            />
          </div>
        </>
      ) : (
        <EntryMissing isAvailable={isAvailable} notFound={COPY.notFound} />
      )}
    </>
  );
}
