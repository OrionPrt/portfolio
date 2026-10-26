import "server-only";

import { withDatabase } from "@/db/client";
import type { Database } from "@/db/types";
import {
  createAuditRepository,
  type AuditActor,
  type AuditEvent,
} from "@/features/auth/audit-repository";
import { checkedRequest } from "@/features/auth/checked-request";
import { requireAdmin, type AdminSession } from "@/features/auth/dal";
import { err, type Result } from "@/lib/result";

/** An audit event as an action writes it: who and from where are filled in. */
export type AdminAuditEvent = Omit<
  AuditEvent,
  "actorId" | "ipHash" | "userAgent"
>;

/** What an admin action works with, once its request is checked. */
export interface AdminScope {
  readonly db: Database;
  readonly session: AdminSession;
  /** For writes that audit themselves in the same statement. */
  readonly actor: AuditActor;
  readonly audit: (event: AdminAuditEvent) => Promise<Result<void>>;
}

/**
 * Runs an admin action. An action is a public endpoint, whatever page shows
 * its form: a full session (else a redirect to the login), the configuration
 * and the origin are checked first, every time. Any failure, from those checks
 * or from the work, reads as unavailable; the details are logged.
 */
export async function runAdmin<T>(
  work: (scope: AdminScope) => Promise<Result<T>>,
): Promise<Result<T, "unavailable">> {
  const session = await requireAdmin();
  const checked = await checkedRequest();
  if (!checked.ok) {
    return checked;
  }
  const { context } = checked.data;
  const actor: AuditActor = {
    actorId: session.user.id,
    ipHash: context.networkHash,
    userAgent: context.userAgent,
  };
  const result = await withDatabase((db) => {
    const audit = createAuditRepository(db);
    return work({
      db,
      session,
      actor,
      audit: (event) => audit.record({ ...event, ...actor }),
    });
  });
  return result.ok ? result : err("unavailable");
}
