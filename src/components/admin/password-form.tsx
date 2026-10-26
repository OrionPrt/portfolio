"use client";

import { useActionState } from "react";

import { FormField } from "@/components/ui/form-field";
import { changePasswordAction } from "@/features/auth/actions";
import { IDLE, type PasswordState } from "@/features/auth/form-state";

import { CodeInput } from "./code-input";
import { ADMIN_COPY } from "./copy";
import { FormAlert } from "./form-alert";
import { FormStatus } from "./form-status";
import { SubmitButton } from "./submit-button";

const COPY = ADMIN_COPY.security.password;

function failureOf(state: PasswordState): string | undefined {
  switch (state.status) {
    case "idle":
    case "done":
      return undefined;
    case "invalid":
      return COPY.problems[state.problem];
    default:
      return ADMIN_COPY.codeFailures[state.status];
  }
}

interface PasswordFormProps {
  /** For password managers, which update the saved entry by username. */
  readonly email: string;
}

/** A new password, against the current one and a TOTP code. */
export function PasswordForm({ email }: PasswordFormProps) {
  const [state, formAction] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    IDLE,
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-5">
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <FormField id="admin-current-password" label={COPY.current}>
        {(control) => (
          <input
            {...control}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={512}
          />
        )}
      </FormField>
      <FormField id="admin-new-password" label={COPY.next} hint={COPY.hint}>
        {(control) => (
          <input
            {...control}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={15}
            maxLength={512}
          />
        )}
      </FormField>
      <CodeInput
        id="admin-password-totp"
        label={COPY.code}
        context={COPY.codeContext}
      />
      <SubmitButton pendingLabel={ADMIN_COPY.pending} look="secondary">
        {COPY.submit}
      </SubmitButton>
      <FormStatus
        message={state.status === "done" ? COPY.done(state.revoked) : undefined}
      />
      <FormAlert message={failureOf(state)} />
    </form>
  );
}
