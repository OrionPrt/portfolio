import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { withDatabase } from "@/db/client";
import { logger } from "@/lib/logger";

import { ADMIN_PATHS } from "./admin-paths";
import { readSessionToken } from "./session-cookie";
import { validateSessionToken } from "./session-service";
import { createSessionsRepository } from "./sessions-repository";
import type { SessionStage } from "./vocabulary";

/** What pages may know of the session: no hash, no secret. */
export interface AdminSession {
  readonly sessionId: string;
  readonly stage: SessionStage;
  readonly expiresAt: Date;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
}

/**
 * The session of this request, checked against the database once per
 * request (React cache). No cookie, an unknown or expired token, an account
 * without a second factor, or a database failure all mean no session: the
 * admin fails closed.
 */
export const getAdminSession = cache(
  async (): Promise<AdminSession | undefined> => {
    const token = await readSessionToken();
    if (token === undefined) {
      return undefined;
    }
    // Never part of a prerender (prefetches included): the check needs the
    // clock, and its answer is this request's alone.
    await connection();
    const validated = await withDatabase((db) =>
      validateSessionToken(createSessionsRepository(db), token, new Date()),
    );
    if (!validated.ok) {
      logger.error("auth.session_check_failed", { code: validated.error.code });
      return undefined;
    }
    // The CLI enrolls the second factor before the account exists: a row
    // without one was changed by hand, and opens nothing.
    if (
      validated.data === undefined ||
      validated.data.user.totpEnabledAt === null
    ) {
      return undefined;
    }
    const { sessionId, stage, expiresAt, user } = validated.data;
    return {
      sessionId,
      stage,
      expiresAt,
      user: { id: user.id, email: user.email },
    };
  },
);

/** Pages and actions of the admin: a full session, or the login page. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session?.stage !== "signed_in") {
    redirect(ADMIN_PATHS.login);
  }
  return session;
}

/** A login step's page and action: only a session at that very step. */
export async function requireLoginStep(
  stage: Exclude<SessionStage, "signed_in">,
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session?.stage !== stage) {
    redirect(ADMIN_PATHS.login);
  }
  return session;
}
