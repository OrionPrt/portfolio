import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MediaLibrary } from "@/components/admin/content/media-library";
import { MediaUploadForm } from "@/components/admin/content/media-upload-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import { createMediaAdminRepository } from "@/features/media/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.media.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.media;

export default async function MediaPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createMediaAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
      <section
        aria-labelledby="media-add"
        className="border-line bg-surface rounded-tile flex flex-col gap-4 border p-4 sm:p-6"
      >
        <h2 id="media-add" className="text-xl font-semibold tracking-tight">
          {COPY.add}
        </h2>
        <MediaUploadForm />
      </section>
      <section aria-labelledby="media-images" className="flex flex-col gap-3">
        <h2 id="media-images" className="text-xl font-semibold tracking-tight">
          {COPY.images}
        </h2>
        {loaded.ok ? (
          <MediaLibrary images={loaded.data} />
        ) : (
          <p className="text-danger">{ADMIN_COPY.unavailable}</p>
        )}
      </section>
    </>
  );
}
