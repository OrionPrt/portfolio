"use client";

import { useActionState } from "react";

import { FormField } from "@/components/ui/form-field";
import { regenerateCodesAction } from "@/features/auth/actions";
import { IDLE, type RecoveryCodesState } from "@/features/auth/form-state";

import { CodeInput } from "./code-input";
import { ADMIN_COPY } from "./copy";
import { FormAlert } from "./form-alert";
import { RecoveryCodesList } from "./recovery-codes-list";
import { SubmitButton } from "./submit-button";

const COPY = ADMIN_COPY.security.recovery;

interface RecoveryCodesFormProps {
  readonly remaining: number;
  /** For password managers, which match the saved entry by username. */
  readonly email: string;
}

/** New recovery codes, against the password and a TOTP code: the old ones stop working. */
export function RecoveryCodesForm({
  remaining,
  email,
}: RecoveryCodesFormProps) {
  const [state, formAction] = useActionState<RecoveryCodesState, FormData>(
    regenerateCodesAction,
    IDLE,
  );
  const failure =
    state.status === "idle" || state.status === "issued"
      ? undefined
      : ADMIN_COPY.codeFailures[state.status];

  return (
    <div className="flex flex-col gap-5">
      <p>{COPY.remaining(remaining)}</p>
      {state.status === "issued" ? (
        <RecoveryCodesList
          codes={state.recoveryCodes}
          title={ADMIN_COPY.recoveryCodes.newTitle}
          headingLevel={3}
        />
      ) : (
        <form action={formAction} className="flex max-w-sm flex-col gap-5">
          <p className="text-fg-muted text-sm">{COPY.lead}</p>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            hidden
          />
          <FormField id="admin-recovery-password" label={COPY.password}>
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
          <CodeInput
            id="admin-recovery-totp"
            label={COPY.code}
            context={COPY.codeContext}
          />
          <SubmitButton pendingLabel={ADMIN_COPY.pending} look="secondary">
            {COPY.submit}
          </SubmitButton>
          <FormAlert message={failure} />
        </form>
      )}
    </div>
  );
}
