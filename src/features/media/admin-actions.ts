"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { media, mediaTranslations } from "@/db/schema";
import { deleteWithSnapshot } from "@/features/admin/audited-delete";
import type {
  ContentFormState,
  ListActionState,
} from "@/features/admin/content-form-state";
import { revalidateContent } from "@/features/admin/revalidate";
import { runAdmin } from "@/features/admin/run-admin";
import { saveContent } from "@/features/admin/save-content";
import { mediaAltSchema } from "@/features/content/schemas";
import { parseServerEnv } from "@/lib/env";
import { ok } from "@/lib/result";

import { createMediaAdminRepository } from "./admin-repository";
import { removeQuietly, selectMediaStorage } from "./storage";

const MEDIA_ID = z.uuid();

/** Named `alt.fr` and `alt.en` in the form: the problems come back by those names. */
const ALT_FORM = z.object({ alt: mediaAltSchema });

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Both texts at once; every page showing the image follows (the media tag). */
export async function updateMediaAltAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const id = MEDIA_ID.safeParse(formData.get("id"));
  return saveContent({
    entity: "media",
    schema: ALT_FORM,
    input: {
      alt: { fr: text(formData, "alt.fr"), en: text(formData, "alt.en") },
    },
    save: (db, { alt }) =>
      id.success
        ? createMediaAdminRepository(db).updateAlt(id.data, alt)
        : Promise.resolve(ok({ status: "not_found" } as const)),
  });
}

type Deletion =
  | { readonly status: "done"; readonly urls: readonly string[] }
  | { readonly status: "not_found" | "in_use" };

/**
 * An image no entry shows any more: its record, with a snapshot in the audit
 * log, then its files. While an entry shows it, it stays (the database
 * refuses it too); files left behind by a failure are logged.
 */
export async function deleteMediaAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const outcome = await runAdmin<Deletion>(async ({ db, actor }) => {
    const id = MEDIA_ID.safeParse(formData.get("id"));
    if (!id.success) {
      return ok({ status: "not_found" });
    }
    const found = await createMediaAdminRepository(db).find(id.data);
    if (!found.ok) {
      return found;
    }
    if (found.data === undefined) {
      return ok({ status: "not_found" });
    }
    if (found.data.usages.length > 0) {
      return ok({ status: "in_use" });
    }
    const deleted = await deleteWithSnapshot(
      db,
      {
        table: media,
        idColumn: media.id,
        id: id.data,
        entity: "media",
        related: [
          {
            key: "translations",
            table: mediaTranslations,
            foreignKey: mediaTranslations.mediaId,
          },
        ],
      },
      actor,
    );
    if (!deleted.ok) {
      return deleted;
    }
    return ok(
      deleted.data === undefined
        ? { status: "not_found" }
        : {
            status: "done",
            urls: found.data.variants.map((variant) => variant.url),
          },
    );
  });
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (outcome.data.status !== "done") {
    return { status: outcome.data.status };
  }
  const storage = selectMediaStorage(parseServerEnv(process.env));
  if (storage !== undefined) {
    await removeQuietly(storage, outcome.data.urls);
  }
  revalidateContent({ entity: "media" });
  refresh();
  return { status: "done" };
}
