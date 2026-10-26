"use client";

import { useActionState } from "react";

import { FormField } from "@/components/ui/form-field";
import { signInAction } from "@/features/auth/actions";
import { IDLE, type LoginState } from "@/features/auth/form-state";

import { ADMIN_COPY } from "./copy";
import { FormAlert } from "./form-alert";
import { SubmitButton } from "./submit-button";

const COPY = ADMIN_COPY.login;

/** Email and password: the first step. Every refusal reads the same. */
export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(
    signInAction,
    IDLE,
  );
  const failure =
    state.status === "idle" ? undefined : COPY.failures[state.status];

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormField id="admin-email" label={COPY.email}>
        {(control) => (
          <input
            {...control}
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            defaultValue={state.status === "idle" ? undefined : state.email}
          />
        )}
      </FormField>
      <FormField id="admin-password" label={COPY.password}>
        {(control) => (
          <input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={512}
          />
        )}
      </FormField>
      <SubmitButton pendingLabel={ADMIN_COPY.pending}>
        {COPY.submit}
      </SubmitButton>
      <FormAlert message={failure} />
    </form>
  );
}
