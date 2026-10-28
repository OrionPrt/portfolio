import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { EntryMissing } from "@/components/admin/content/entry-pages";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { MediaAltForm } from "@/components/admin/content/media-alt-form";
import { MediaUsages } from "@/components/admin/content/media-library";
import { ADMIN_COPY } from "@/components/admin/copy";
import { MediaImage } from "@/components/ui/media-image";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { deleteMediaAction } from "@/features/media/admin-actions";
import { createMediaAdminRepository } from "@/features/media/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.media.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.media;

export default async function EditMediaPage({
  params,
}: PageProps<"/admin/media/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const found = await withDatabase((db) =>
    createMediaAdminRepository(db).find(id),
  );
  const image = found.ok ? found.data : undefined;

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.media} label={COPY.back} />
      {image !== undefined ? (
        <>
          <figure className="flex flex-col gap-2">
            <MediaImage
              image={{ ...image, alt: image.alt.fr }}
              sizes="(min-width: 1024px) 640px, 100vw"
              isPriority
              className="bg-surface-muted border-line rounded-tile max-h-96 w-full border object-contain"
            />
            <figcaption className="text-fg-muted text-sm">
              {COPY.size(image.width, image.height)} ·{" "}
              {COPY.variants(image.variants.map((variant) => variant.width))}
            </figcaption>
          </figure>
          {/* Keyed: another image's page keeps its own form state. */}
          <MediaAltForm key={image.id} image={image} />
          <MediaUsages usages={image.usages} />
          <div className="border-line border-t pt-6">
            {image.usages.length === 0 ? (
              <DeleteEntry
                action={deleteMediaAction}
                id={image.id}
                label={image.alt.fr}
                title={COPY.deleteTitle}
                afterDelete={ADMIN_PATHS.media}
                consequence={COPY.deleteConsequence}
              />
            ) : (
              <p className="text-fg-muted">{COPY.inUse}</p>
            )}
          </div>
        </>
      ) : (
        <EntryMissing isAvailable={found.ok} notFound={COPY.notFound} />
      )}
    </>
  );
}
