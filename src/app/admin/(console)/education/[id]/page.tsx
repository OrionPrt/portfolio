import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { EducationForm } from "@/components/admin/content/education-form";
import { EntryMissing } from "@/components/admin/content/entry-pages";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import {
  deleteEducationAction,
  updateEducationAction,
} from "@/features/catalog/education-admin-actions";
import { createEducationAdminRepository } from "@/features/catalog/education-admin-repository";
import { loadMediaOptions } from "@/features/media/media-options";

export const metadata: Metadata = { title: ADMIN_COPY.education.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.education;

export default async function EditEducationPage({
  params,
}: PageProps<"/admin/education/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [found, media] = await Promise.all([
    withDatabase((db) => createEducationAdminRepository(db).find(id)),
    withDatabase(loadMediaOptions),
  ]);
  const entry = found.ok ? found.data : undefined;
  const label =
    entry === undefined
      ? ""
      : ADMIN_COPY.entries.label(entry.translations.fr?.degree, entry.school);

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.education} label={COPY.back} />
      {entry !== undefined && media.ok ? (
        <>
          {/* Keyed: another entry's page keeps its own form state. */}
          <EducationForm
            key={entry.id}
            action={updateEducationAction}
            entry={entry}
            media={media.data}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deleteEducationAction}
              id={entry.id}
              label={label}
              title={COPY.deleteTitle(label)}
              afterDelete={ADMIN_PATHS.education}
              consequence={COPY.deleteConsequence}
            />
          </div>
        </>
      ) : (
        <EntryMissing
          isAvailable={found.ok && media.ok}
          notFound={COPY.notFound}
        />
      )}
    </>
  );
}
