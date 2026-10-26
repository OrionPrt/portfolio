import type { PasswordProblem } from "./vocabulary";

// Shared by the admin's forms and its server actions: keep it free of server code.

/** Why an attempt did not go through; the UI words each one the same way for any cause. */
export type AuthFailure = "refused" | "locked" | "unavailable";

export type LoginState =
  | { readonly status: "idle" }
  /** The email typed, to refill the field React empties after the action. */
  | { readonly status: AuthFailure; readonly email: string };

export type CodeState =
  { readonly status: "idle" } | { readonly status: AuthFailure };

/** Recovery codes are shown once, from this state, never stored in clear. */
export type RecoveryCodesState =
  | CodeState
  | { readonly status: "issued"; readonly recoveryCodes: readonly string[] };

export type SessionsState =
  | { readonly status: "idle" }
  | {
      readonly status: AuthFailure | "nothing_selected";
      /** The sessions ticked, ticked again after React resets the form. */
      readonly selected: readonly string[];
    }
  | { readonly status: "done"; readonly revoked: number };

export type PasswordState =
  | CodeState
  | {
      readonly status: "invalid";
      readonly problem: PasswordProblem | "breached";
    }
  | { readonly status: "done"; readonly revoked: number };

export const IDLE = { status: "idle" } as const;
