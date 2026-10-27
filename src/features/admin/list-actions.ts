import "server-only";

import { refresh } from "next/cache";
import { z } from "zod";

import type { Database } from "@/db/types";
import { ok, type Result } from "@/lib/result";

import { deleteWithSnapshot, type SnapshotTarget } from "./audited-delete";
import type { ListActionState } from "./content-form-state";
import type { ContentEntity } from "./content-tags";
import { moveItem } from "./ordering";
import { revalidateContent } from "./revalidate";
import { runAdmin } from "./run-admin";

const ENTRY_ID = z.uuid();
const MOVE = z.object({ id: ENTRY_ID, direction: z.enum(["up", "down"]) });

/** Done, with the slugs whose pages changed (a deleted entry's), or not found. */
type Outcome =
  | { readonly isFound: true; readonly slugs: readonly string[] }
  | { readonly isFound: false };

const DONE: Outcome = { isFound: true, slugs: [] };
const NOT_FOUND: Outcome = { isFound: false };

/** The page shows the change at once; a missing entry reads as such. */
function settle(
  outcome: Result<Outcome, "unavailable">,
  entity: ContentEntity,
): ListActionState {
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (!outcome.data.isFound) {
    return { status: "not_found" };
  }
  revalidateContent({ entity, slugs: outcome.data.slugs });
  refresh();
  return { status: "done" };
}

interface MoveRequest {
  readonly entity: ContentEntity;
  readonly formData: FormData;
  /** The ids in their current order, among which the entry moves. */
  readonly siblings: (
    db: Database,
    id: string,
  ) => Promise<Result<readonly string[]>>;
  readonly reorder: (
    db: Database,
    ids: readonly string[],
  ) => Promise<Result<void>>;
}

/** One step up or down within its list, audited. At an end, nothing moves. */
export async function moveContent(
  request: MoveRequest,
): Promise<ListActionState> {
  const outcome = await runAdmin<Outcome>(async ({ db, audit }) => {
    const parsed = MOVE.safeParse({
      id: request.formData.get("id"),
      direction: request.formData.get("direction"),
    });
    if (!parsed.success) {
      return ok(NOT_FOUND);
    }
    const { id, direction } = parsed.data;
    const siblings = await request.siblings(db, id);
    if (!siblings.ok) {
      return siblings;
    }
    if (!siblings.data.includes(id)) {
      return ok(NOT_FOUND);
    }
    const order = moveItem(siblings.data, id, direction);
    if (order === undefined) {
      return ok(DONE);
    }
    const reordered = await request.reorder(db, order);
    if (!reordered.ok) {
      return reordered;
    }
    await audit({
      action: "content.reordered",
      entity: request.entity,
      entityId: id,
    });
    return ok(DONE);
  });
  return settle(outcome, request.entity);
}

interface DeleteRequest {
  readonly entity: ContentEntity;
  readonly formData: FormData;
  readonly target: (id: string) => SnapshotTarget;
}

/**
 * Deletion for good, with its snapshot in the audit log (one statement). The
 * page then says so, and leaves the entry's own page if it was there.
 */
export async function deleteContent(
  request: DeleteRequest,
): Promise<ListActionState> {
  const outcome = await runAdmin<Outcome>(async ({ db, actor }) => {
    const parsed = ENTRY_ID.safeParse(request.formData.get("id"));
    if (!parsed.success) {
      return ok(NOT_FOUND);
    }
    const deleted = await deleteWithSnapshot(
      db,
      request.target(parsed.data),
      actor,
    );
    if (!deleted.ok) {
      return deleted;
    }
    const { data } = deleted;
    return ok(
      data === undefined
        ? NOT_FOUND
        : { isFound: true, slugs: data.slug === undefined ? [] : [data.slug] },
    );
  });
  return settle(outcome, request.entity);
}
