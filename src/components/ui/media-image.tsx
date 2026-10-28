import type { MediaVariant } from "@/db/schema";
import type { MediaView } from "@/features/media/types";

interface MediaImageProps {
  readonly image: MediaView;
  /** How wide it shows, so the browser picks a width: "(min-width: 768px) 50vw, 100vw". */
  readonly sizes: string;
  /** Empty when the image only adorns what the text beside it says. */
  readonly alt?: string;
  readonly className?: string;
  /** The page's main image, above the fold: fetched at once. */
  readonly isPriority?: boolean;
}

/**
 * An image of the library at the width the layout needs: its WebP variants as
 * a srcset (ADR-0007). Not next/image: the widths are made at upload, so no
 * optimizer runs, and each image knows which widths it has.
 */
export function MediaImage({
  image,
  sizes,
  alt = image.alt,
  className,
  isPriority = false,
}: MediaImageProps) {
  const largest = image.variants[image.variants.length - 1];
  // The database refuses an image without one: nothing to show otherwise.
  if (largest === undefined) {
    return null;
  }
  const srcSet = image.variants
    .map((variant) => `${variant.url} ${String(variant.width)}w`)
    .join(", ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- widths made at upload (ADR-0007)
    <img
      src={largest.url}
      srcSet={srcSet}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={isPriority ? "eager" : "lazy"}
      fetchPriority={isPriority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

interface MediaThumbnailProps {
  readonly variant: MediaVariant;
  readonly sizes: string;
  readonly className?: string;
}

/** One stored width, silent: a list or a picker names the image beside it. */
export function MediaThumbnail({
  variant,
  sizes,
  className,
}: MediaThumbnailProps) {
  return (
    <MediaImage
      image={{
        alt: "",
        width: variant.width,
        height: variant.height,
        variants: [variant],
      }}
      alt=""
      sizes={sizes}
      className={className}
    />
  );
}
