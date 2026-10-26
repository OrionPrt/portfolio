"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { withDatabase } from "@/db/client";
import { err, type Result } from "@/lib/result";

import {
  changePassword,
  regenerateRecoveryCodes,
  revokeSessions,
  signOut,
} from "./account-security";
import type { AttemptContext } from "./attempts";
import type { AuthDependencies } from "./auth-dependencies";
import { checkedRequest } from "./checked-request";
import { ADMIN_PATHS } from "./admin-paths";
import {
  getAdminSession,
  requireAdmin,
  requireLoginStep,
  type AdminSession,
} from "./dal";
import { authDependencies } from "./dependencies";
import type {
  CodeState,
  LoginState,
  PasswordState,
  RecoveryCodesState,
  SessionsState,
} from "./form-state";
import { verifySecondFactor } from "./second-factor";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "./session-cookie";
import { isWellFormedSessionToken, sessionIdOf } from "./session-token";
import { signIn } from "./sign-in";

// Every action re-checks configuration, origin and session itself: an action
// is a public endpoint, whatever page shows its form.

const SESSION_ID = /^[0-9a-f]{64}$/;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Runs a flow on the real services; configuration, origin or database problems read as unavailable. */
async function runAuth<T>(
  run: (deps: AuthDependencies, context: AttemptContext) => Promise<Result<T>>,
): Promise<Result<T, "unavailable">> {
  const checked = await checkedRequest();
  if (!checked.ok) {
    return checked;
  }
  const { config, context } = checked.data;
  const result = await withDatabase((db) =>
    run(authDependencies(db, config), context),
  );
  return result.ok ? result : err("unavailable");
}

function currentOf(session: AdminSession) {
  return {
    sessionId: session.sessionId,
    userId: session.user.id,
    email: session.user.email,
  };
}

/** The session the browser still holds, if its cookie is well formed. */
async function previousSessionId(): Promise<string | undefined> {
  const token = await readSessionToken();
  return token !== undefined && isWellFormedSessionToken(token)
    ? sessionIdOf(token)
    : undefined;
}

export async function signInAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = field(formData, "email");
  const previous = await previousSessionId();
  const outcome = await runAuth((deps, context) =>
    signIn(
      {
        email,
        password: field(formData, "password"),
        ...(previous === undefined ? {} : { previousSessionId: previous }),
      },
      context,
      deps,
    ),
  );
  if (!outcome.ok) {
    return { status: "unavailable", email };
  }
  if (outcome.data.status !== "next") {
    return { status: outcome.data.status, email };
  }
  const { session } = outcome.data;
  await setSessionCookie(session.token, session.expiresAt);
  redirect(ADMIN_PATHS.secondFactor);
}

export async function secondFactorAction(
  _previous: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const current = await requireLoginStep("totp_challenge");
  const kind =
    field(formData, "method") === "recovery_code" ? "recovery_code" : "totp";
  const outcome = await runAuth((deps, context) =>
    verifySecondFactor(
      { kind, code: field(formData, "code") },
      currentOf(current),
      context,
      deps,
    ),
  );
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (outcome.data.status !== "signed_in") {
    // A lock also ended the partial session: the page offers to start over.
    return { status: outcome.data.status };
  }
  await setSessionCookie(
    outcome.data.session.token,
    outcome.data.session.expiresAt,
  );
  redirect(ADMIN_PATHS.home);
}

export async function signOutAction(): Promise<void> {
  const current = await getAdminSession();
  if (current !== undefined) {
    await runAuth((deps, context) =>
      signOut(currentOf(current), context, deps),
    );
  }
  await clearSessionCookie();
  redirect(ADMIN_PATHS.login);
}

export async function revokeSessionsAction(
  _previous: SessionsState,
  formData: FormData,
): Promise<SessionsState> {
  const current = await requireAdmin();
  const selected = formData
    .getAll("sessionId")
    .filter(
      (value): value is string =>
        typeof value === "string" && SESSION_ID.test(value),
    );
  const others = field(formData, "scope") === "others";
  // Checked before the code is used: a code works once per 30 seconds.
  if (!others && selected.length === 0) {
    return { status: "nothing_selected", selected };
  }
  const outcome = await runAuth((deps, context) =>
    revokeSessions(
      { code: field(formData, "code"), sessionIds: selected, others },
      currentOf(current),
      context,
      deps,
    ),
  );
  if (!outcome.ok) {
    return { status: "unavailable", selected };
  }
  if (outcome.data.status !== "done") {
    return { status: outcome.data.status, selected };
  }
  if (outcome.data.signedOut) {
    await clearSessionCookie();
    redirect(ADMIN_PATHS.login);
  }
  refresh();
  return { status: "done", revoked: outcome.data.revoked };
}

export async function regenerateCodesAction(
  _previous: RecoveryCodesState,
  formData: FormData,
): Promise<RecoveryCodesState> {
  const current = await requireAdmin();
  const outcome = await runAuth((deps, context) =>
    regenerateRecoveryCodes(
      {
        password: field(formData, "currentPassword"),
        code: field(formData, "code"),
      },
      currentOf(current),
      context,
      deps,
    ),
  );
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (outcome.data.status !== "done") {
    return { status: outcome.data.status };
  }
  // Updates the count of codes left; the new codes stay in this state.
  refresh();
  return { status: "issued", recoveryCodes: outcome.data.recoveryCodes };
}

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const current = await requireAdmin();
  const outcome = await runAuth((deps, context) =>
    changePassword(
      {
        currentPassword: field(formData, "currentPassword"),
        newPassword: field(formData, "newPassword"),
        code: field(formData, "code"),
      },
      currentOf(current),
      context,
      deps,
    ),
  );
  if (!outcome.ok) {
    return { status: "unavailable" };
  }
  if (outcome.data.status === "done") {
    refresh();
  }
  return outcome.data;
}
