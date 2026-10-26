"use client";

import { useActionState } from "react";

import { revokeSessionsAction } from "@/features/auth/actions";
import { IDLE, type SessionsState } from "@/features/auth/form-state";

import { CodeInput } from "./code-input";
import { ADMIN_COPY } from "./copy";
import { formatParisDateTime } from "./format";
import { FormAlert } from "./form-alert";
import { FormStatus } from "./form-status";
import { SubmitButton } from "./submit-button";

const COPY = ADMIN_COPY.security.sessions;

/** A session as the page shows it: no token, its hash only as a form value. */
export interface SessionView {
  readonly id: string;
  /** "Firefox · Linux", when the user agent tells. */
  readonly device: string | undefined;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly isCurrent: boolean;
}

interface SessionsFormProps {
  readonly sessions: readonly SessionView[];
}

function failureOf(state: SessionsState): string | undefined {
  switch (state.status) {
    case "idle":
    case "done":
      return undefined;
    case "nothing_selected":
      return COPY.nothingSelected;
    default:
      return ADMIN_COPY.codeFailures[state.status];
  }
}

/**
 * The account's sessions. Revoking some, or every other one, takes a TOTP
 * code (ASVS 7.5.2); revoking the current one signs out.
 */
export function SessionsForm({ sessions }: SessionsFormProps) {
  const [state, formAction] = useActionState<SessionsState, FormData>(
    revokeSessionsAction,
    IDLE,
  );
  const selected = "selected" in state ? state.selected : [];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset>
        <legend className="sr-only">{COPY.legend}</legend>
        <ul role="list" className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <label className="border-line rounded-control has-checked:border-fg-muted flex cursor-pointer items-start gap-3 border p-4">
                <input
                  type="checkbox"
                  name="sessionId"
                  value={session.id}
                  defaultChecked={selected.includes(session.id)}
                  className="mt-1 size-4"
                />
                <span className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">
                    {session.device ?? COPY.unknownDevice}
                    {session.isCurrent && (
                      <>
                        {" "}
                        <span className="text-accent font-mono text-xs">
                          {COPY.current}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-fg-muted">
                    {COPY.started} {formatParisDateTime(session.createdAt)} ·{" "}
                    {COPY.lastSeen} {formatParisDateTime(session.lastSeenAt)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex max-w-sm flex-col gap-5">
        <p className="text-fg-muted text-sm">{COPY.lead}</p>
        <CodeInput
          id="admin-sessions-totp"
          label={COPY.code}
          context={COPY.codeContext}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton
          name="scope"
          value="selected"
          look="secondary"
          pendingLabel={ADMIN_COPY.pending}
        >
          {COPY.revokeSelected}
        </SubmitButton>
        <SubmitButton
          name="scope"
          value="others"
          look="secondary"
          pendingLabel={ADMIN_COPY.pending}
        >
          {COPY.revokeOthers}
        </SubmitButton>
      </div>
      <FormStatus
        message={state.status === "done" ? COPY.done(state.revoked) : undefined}
      />
      <FormAlert message={failureOf(state)} />
    </form>
  );
}
