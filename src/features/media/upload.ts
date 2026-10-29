import "server-only";

import { MAX_MEDIA } from "@/db/limits";
import type { MediaVariant } from "@/db/schema";
import type { AdminScope } from "@/features/admin/run-admin";
import { runAdminRoute } from "@/features/admin/run-admin";
import {
  fieldProblemsOf,
  type FieldProblem,
} from "@/features/admin/form-input";
import { mediaAltSchema } from "@/features/content/schemas";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";

import { createMediaAdminRepository } from "./admin-repository";
import {
  MAX_UPLOAD_BYTES,
  processImage,
  type ProcessedImage,
} from "./image-processing";
import { mediaPathname, removeQuietly, type MediaStorage } from "./storage";

/** What an upload says, as the library's form shows it. */
export type UploadOutcome =
  | { readonly status: "saved"; readonly id: string }
  | {
      readonly status: "invalid";
      /** `file`, `alt.fr`, `alt.en`; a file "taken" is already in the library. */
      readonly problems: Readonly<Record<string, FieldProblem>>;
    }
  | { readonly status: "full" }
  | { readonly status: "unavailable" }
  | { readonly status: "signed_out" };

type Problems = Readonly<Record<string, FieldProblem>>;

const invalid = (problems: Problems): UploadOutcome => ({
  status: "invalid",
  problems,
});

/** The form's fields, each checked: the file present, both texts given. */
function fieldsOf(formData: FormData) {
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const alt = mediaAltSchema.safeParse({
    fr: formData.get("alt.fr"),
    en: formData.get("alt.en"),
  });
  const altProblems = alt.success
    ? {}
    : Object.fromEntries(
        Object.entries(fieldProblemsOf(alt.error)).map(([key, problem]) => [
          `alt.${key}`,
          problem,
        ]),
      );
  const problems: Problems = {
    ...(hasFile ? {} : { file: { problem: "required" } }),
    ...altProblems,
  };
  return hasFile && alt.success
    ? ({ ok: true, file, alt: alt.data } as const)
    : ({ ok: false, problems } as const);
}

/** Every width stored, or none: a failed write removes the others. */
async function storeVariants(
  storage: MediaStorage,
  id: string,
  image: ProcessedImage,
): Promise<Result<readonly MediaVariant[], "unavailable">> {
  const stored = await Promise.allSettled(
    image.variants.map(async ({ width, height, data }) => ({
      width,
      height,
      bytes: data.length,
      url: await storage.put(mediaPathname(id, width), data, "image/webp"),
    })),
  );
  const variants = stored.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failure = stored.find((result) => result.status === "rejected");
  if (failure === undefined) {
    return ok(variants);
  }
  // The storage's own words: a missing store, a refused token, a private store…
  logger.error("media.store_failed", { id, error: failure.reason });
  await removeQuietly(
    storage,
    variants.map((variant) => variant.url),
  );
  return err("unavailable");
}

async function store(
  { db, audit }: AdminScope,
  storage: MediaStorage,
  formData: FormData,
): Promise<Result<UploadOutcome>> {
  const fields = fieldsOf(formData);
  if (!fields.ok) {
    return ok(invalid(fields.problems));
  }
  const media = createMediaAdminRepository(db);
  const counted = await media.count();
  if (!counted.ok) {
    return counted;
  }
  if (counted.data >= MAX_MEDIA) {
    return ok({ status: "full" });
  }
  // Whatever the request claimed: a file over the limit is never read.
  if (fields.file.size > MAX_UPLOAD_BYTES) {
    return ok(invalid({ file: { problem: "invalid" } }));
  }
  const processed = await processImage(
    new Uint8Array(await fields.file.arrayBuffer()),
  );
  if (!processed.ok) {
    return ok(invalid({ file: { problem: "invalid" } }));
  }
  const existing = await media.idOfFile(processed.data.sha256);
  if (!existing.ok) {
    return existing;
  }
  if (existing.data !== undefined) {
    return ok(invalid({ file: { problem: "taken" } }));
  }
  const id = crypto.randomUUID();
  const variants = await storeVariants(storage, id, processed.data);
  if (!variants.ok) {
    return ok({ status: "unavailable" });
  }
  const largest = variants.data[variants.data.length - 1];
  const created = await media.create({
    id,
    sha256: processed.data.sha256,
    pathname: `media/${id}`,
    width: largest?.width ?? 0,
    height: largest?.height ?? 0,
    variants: variants.data,
    alt: fields.alt,
  });
  if (!created.ok) {
    await removeQuietly(
      storage,
      variants.data.map((variant) => variant.url),
    );
    return created;
  }
  await audit({ action: "content.created", entity: "media", entityId: id });
  return ok({ status: "saved", id });
}

/**
 * An image added to the library (ADR-0007): the session and the origin
 * first, the body read only then. Checked by its bytes, re-encoded, stored at
 * each width, then recorded; a failure on the way leaves no file behind.
 */
export async function uploadMedia(
  request: Request,
  storage: MediaStorage | undefined,
): Promise<UploadOutcome> {
  const outcome = await runAdminRoute(async (scope) => {
    if (storage === undefined) {
      logger.error("media.storage_not_configured");
      return ok({ status: "unavailable" } as const);
    }
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return ok(invalid({ file: { problem: "invalid" } }));
    }
    return store(scope, storage, formData);
  });
  if (outcome.ok) {
    return outcome.data;
  }
  return {
    status: outcome.error === "signed_out" ? "signed_out" : "unavailable",
  };
}
