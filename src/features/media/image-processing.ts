import { createHash } from "node:crypto";

import sharp from "sharp";

import { err, ok, type Result } from "@/lib/result";

import { MAX_UPLOAD_BYTES } from "./limits";

export { MAX_UPLOAD_BYTES };

/** Decoded size beyond which an image is refused unread: a decompression bomb. */
const MAX_INPUT_PIXELS = 40_000_000;

/** The widths stored, at most: a card, a page, a wide screen. */
export const VARIANT_WIDTHS = [480, 960, 1600] as const;

const WEBP_QUALITY = 80;

export type ImageFormat = "jpeg" | "png" | "webp";

/** Why an upload was refused. */
export type ImageProblem = "too_large" | "unsupported" | "unreadable";

export interface ProcessedVariant {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

export interface ProcessedImage {
  /** The uploaded file's, in hex. */
  readonly sha256: string;
  /** Narrowest first. */
  readonly variants: readonly ProcessedVariant[];
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0) {
  return prefix.every((byte, index) => bytes[at + index] === byte);
}

const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/**
 * The format by the file's first bytes, whatever its name or declared type.
 * Anything else (SVG, GIF, HTML…) is refused before any decoder sees it.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  return startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)
    ? "webp"
    : undefined;
}

/** The widths to store for a source this wide: never wider than the source. */
function widthsFor(sourceWidth: number): readonly number[] {
  const largest = Math.min(
    sourceWidth,
    VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1] ?? sourceWidth,
  );
  return [...VARIANT_WIDTHS.filter((width) => width < largest), largest];
}

/** EXIF orientations 5 to 8 turn the image a quarter: width and height swap. */
function isQuarterTurned(orientation: number | undefined): boolean {
  return orientation !== undefined && orientation >= 5;
}

async function variantOf(
  bytes: Uint8Array,
  width: number,
): Promise<ProcessedVariant> {
  const { data, info } = await sharp(bytes, {
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    // Upright first: the orientation goes with the rest of the metadata.
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

/**
 * An uploaded image, checked then re-encoded: up to three WebP widths, with
 * no metadata (location, camera), which also defeats polyglot files. The
 * header is read first, so an oversized image is refused undecoded.
 */
export async function processImage(
  bytes: Uint8Array,
): Promise<Result<ProcessedImage, ImageProblem>> {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return err("too_large");
  }
  const format = sniffImageFormat(bytes);
  if (format === undefined) {
    return err("unsupported");
  }
  try {
    // The header only, nothing decoded: the size check below is ours.
    const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (metadata.format !== format) {
      return err("unsupported");
    }
    if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
      return err("too_large");
    }
    const sourceWidth = isQuarterTurned(metadata.orientation)
      ? metadata.height
      : metadata.width;
    const variants = await Promise.all(
      widthsFor(sourceWidth).map((width) => variantOf(bytes, width)),
    );
    return ok({
      sha256: createHash("sha256").update(bytes).digest("hex"),
      variants,
    });
  } catch {
    return err("unreadable");
  }
}
