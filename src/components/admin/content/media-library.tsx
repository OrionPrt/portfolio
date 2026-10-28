import Link from "next/link";
import { useId } from "react";

import { MediaThumbnail } from "@/components/ui/media-image";
import {
  certificationPath,
  educationPath,
  experiencePath,
  mediaPath,
  projectPath,
} from "@/features/auth/admin-paths";
import type {
  MediaListEntry,
  MediaUsage,
} from "@/features/media/admin-repository";

import { ADMIN_COPY } from "../copy";

const COPY = ADMIN_COPY.media;

interface MediaLibraryProps {
  readonly images: readonly MediaListEntry[];
}

/** The library's images, the latest first, each by its French text. */
export function MediaLibrary({ images }: MediaLibraryProps) {
  if (images.length === 0) {
    return <p className="text-fg-muted">{COPY.empty}</p>;
  }
  return (
    // role="list": Safari drops list semantics once list-style is none.
    <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => (
        <li
          key={image.id}
          className="border-line bg-surface rounded-tile flex flex-col overflow-hidden border"
        >
          {/* Its text is just below: the thumbnail adorns it. */}
          <MediaThumbnail
            variant={image.thumbnail}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="bg-surface-muted aspect-video w-full object-contain"
          />
          <div className="flex flex-1 flex-col gap-2 p-4">
            {/* A heading each: the grid is walked from image to image. */}
            <h3 className="font-medium">{image.alt}</h3>
            <p className="text-fg-muted text-sm">
              {COPY.size(image.width, image.height)} ·{" "}
              {COPY.usage(image.usageCount)}
            </p>
            <Link
              href={mediaPath(image.id)}
              className="border-line hover:border-fg-muted rounded-control mt-auto inline-flex min-h-10 items-center self-start border px-3 text-sm font-medium"
            >
              {ADMIN_COPY.content.edit}{" "}
              <span className="sr-only">{image.alt}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

const PATHS: Readonly<Record<MediaUsage["kind"], (id: string) => string>> = {
  project: projectPath,
  experience: experiencePath,
  education: educationPath,
  certification: certificationPath,
};

interface MediaUsagesProps {
  readonly usages: readonly MediaUsage[];
}

/** The entries that show an image, each a link to its page. */
export function MediaUsages({ usages }: MediaUsagesProps) {
  // Unique: a page visited earlier stays mounted, hidden, with its own list.
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {COPY.usedBy}
      </h2>
      {usages.length === 0 ? (
        <p className="text-fg-muted">{COPY.unused}</p>
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {usages.map((usage) => (
            <li key={`${usage.kind}-${usage.id}`}>
              <Link
                href={PATHS[usage.kind](usage.id)}
                className="underline-offset-4 hover:underline"
              >
                <span className="text-fg-muted">
                  {COPY.usageKinds[usage.kind]}
                </span>{" "}
                {usage.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
