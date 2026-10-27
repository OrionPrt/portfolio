import "server-only";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import type { Database } from "@/db/types";
import { ok, type Result } from "@/lib/result";

import type { ContentFormState } from "./content-form-state";
import type { ContentEntity } from "./content-tags";
import { fieldProblemsOf, type FieldProblem } from "./form-input";
import { revalidateContent } from "./revalidate";
import { runAdmin } from "./run-admin";

/** What a repository's save says. */
export type SaveOutcome =
  | {
      readonly status: "saved";
      readonly id: string;
      readonly isNew: boolean;
      /** The slugs whose pages change: both, when one is renamed. */
      readonly slugs?: readonly string[];
      /** What the audit log keeps of it: text the save removed, for instance. */
      readonly diff?: Readonly<Record<string, unknown>>;
    }
  /** Another entry holds this field's value (a slug, a link's kind). */
  | { readonly status: "conflict"; readonly field: string }
  | { readonly status: "not_found" }
  /** No room for one more entry of its kind. */
  | { readonly status: "full" };

interface SaveRequest<S extends z.ZodType> {
  readonly entity: ContentEntity;
  readonly schema: S;
  /** The input, shaped for the schema. */
  readonly input: unknown;
  readonly save: (
    db: Database,
    data: z.output<S>,
  ) => Promise<Result<SaveOutcome>>;
  /** Where a new entry goes once created: its list, for instance. */
  readonly afterCreate?: (id: string) => string;
}

/** The input refused, or what the save said. */
type Checked =
  | SaveOutcome
  | {
      readonly status: "invalid";
      readonly problems: Readonly<Record<string, FieldProblem>>;
    };

/** A save that did not happen, as the form shows it: a conflict sits on its field. */
function refusalOf(
  outcome: Exclude<SaveOutcome, { status: "saved" }>,
): ContentFormState {
  return outcome.status === "conflict"
    ? { status: "invalid", problems: { [outcome.field]: { problem: "taken" } } }
    : { status: outcome.status };
}

/**
 * A content save, as every admin form does it: the session first (runAdmin),
 * then the input (Zod), the write, the audit, and the caches the change makes
 * stale. Once saved, the page refreshes, so the form shows what was stored.
 */
export async function saveContent<S extends z.ZodType>(
  request: SaveRequest<S>,
): Promise<ContentFormState> {
  const { entity } = request;
  const outcome = await runAdmin<Checked>(async ({ db, audit }) => {
    const parsed = request.schema.safeParse(request.input);
    if (!parsed.success) {
      return ok({
        status: "invalid",
        problems: fieldProblemsOf(parsed.error),
      });
    }
    const saved = await request.save(db, parsed.data);
    if (saved.ok && saved.data.status === "saved") {
      await audit({
        action: saved.data.isNew ? "content.created" : "content.updated",
        entity,
        entityId: saved.data.id,
        ...(saved.data.diff === undefined ? {} : { diff: saved.data.diff }),
      });
    }
    return saved;
  });
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  const result = outcome.data;
  if (result.status === "invalid") {
    return result;
  }
  if (result.status !== "saved") {
    return refusalOf(result);
  }
  revalidateContent({ entity, slugs: result.slugs });
  if (result.isNew && request.afterCreate !== undefined) {
    redirect(request.afterCreate(result.id));
  }
  refresh();
  return { status: "saved" };
}
