"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { BUTTON_CLASSES } from "@/components/ui/button-classes";
import { FormField } from "@/components/ui/form-field";
import { secondFactorAction } from "@/features/auth/actions";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { IDLE, type CodeState } from "@/features/auth/form-state";

import { CodeInput } from "./code-input";
import { ADMIN_COPY } from "./copy";
import { FormAlert } from "./form-alert";
import { SubmitButton } from "./submit-button";

const COPY = ADMIN_COPY.secondFactor;

type Method = "totp" | "recovery_code";

interface MethodFormProps {
  readonly method: Method;
  /** Moves focus to the field: after the owner switched methods, not on load. */
  readonly isFocused: boolean;
}

/** One method's form, with its own state: an error does not carry over. */
function MethodForm({ method, isFocused }: MethodFormProps) {
  const [state, formAction] = useActionState<CodeState, FormData>(
    secondFactorAction,
    IDLE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const failure =
    state.status === "idle" ? undefined : ADMIN_COPY.codeFailures[state.status];

  useEffect(() => {
    if (isFocused) {
      formRef.current
        ?.querySelector<HTMLInputElement>("input[name=code]")
        ?.focus();
    }
  }, [isFocused]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="method" value={method} />
      {method === "totp" ? (
        <CodeInput id="admin-code" label={COPY.code} hint={COPY.lead} />
      ) : (
        <FormField
          id="admin-recovery-code"
          label={COPY.recoveryCode}
          hint={COPY.recoveryLead}
        >
          {(control) => (
            <input
              {...control}
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={40}
              className={`${control.className} font-mono`}
            />
          )}
        </FormField>
      )}
      <SubmitButton pendingLabel={ADMIN_COPY.pending}>
        {COPY.submit}
      </SubmitButton>
      <FormAlert message={failure}>
        {state.status === "locked" && (
          <a
            href={ADMIN_PATHS.login}
            className="text-fg underline underline-offset-4"
          >
            {COPY.restart}
          </a>
        )}
      </FormAlert>
    </form>
  );
}

/** The second step: the authenticator's code, or a one-time recovery code. */
export function SecondFactorForm() {
  const [method, setMethod] = useState<Method>("totp");
  const [hasSwitched, setHasSwitched] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <MethodForm key={method} method={method} isFocused={hasSwitched} />
      {/* The way back in without the phone: a full-size button, not a link. */}
      <button
        type="button"
        onClick={() => {
          setMethod(method === "totp" ? "recovery_code" : "totp");
          setHasSwitched(true);
        }}
        className={`${BUTTON_CLASSES.secondary} self-start`}
      >
        {method === "totp" ? COPY.useRecovery : COPY.useTotp}
      </button>
    </div>
  );
}
