import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "./vocabulary";

// Strict: never sent on a request started by another site. Only server
// actions write it.

const ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
} as const;

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    ...ATTRIBUTES,
    expires: expiresAt,
  });
}

/** Same attributes, or the browser would refuse to replace a __Host- cookie. */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...ATTRIBUTES, maxAge: 0 });
}
