import { z } from "zod";

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { logger } from "@/lib/logger";

import { TURNSTILE_TEST_KEYS } from "./config";
import { TURNSTILE_ACTION } from "./form-state";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile tokens are at most 2048 characters. */
const MAX_TOKEN_LENGTH = 2048;
const VERIFY_TIMEOUT_MS = 8000;

const verdictSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

interface VerifyInput {
  readonly token: string;
  readonly secretKey: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Asks Cloudflare whether a widget token is genuine. Anything short of a clear
 * yes is a no: an unreachable API, an odd answer or another action's token.
 * The visitor's IP is not sent: the widget already ran in their browser.
 */
export async function verifyTurnstileToken({
  token,
  secretKey,
  fetchImpl = fetchWithTimeout(fetch, VERIFY_TIMEOUT_MS),
}: VerifyInput): Promise<boolean> {
  if (token === "" || token.length > MAX_TOKEN_LENGTH) {
    return false;
  }
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const verdict = verdictSchema.safeParse(await response.json());
    if (!verdict.success) {
      logger.warn("contact.turnstile_unexpected", { status: response.status });
      return false;
    }
    const { success, action } = verdict.data;
    if (!success) {
      logger.info("contact.turnstile_rejected", {
        codes: verdict.data["error-codes"] ?? [],
      });
      return false;
    }
    // A real widget reports its action; the test keys' tokens carry none.
    return secretKey === TURNSTILE_TEST_KEYS.secretKey
      ? action === undefined || action === "" || action === TURNSTILE_ACTION
      : action === TURNSTILE_ACTION;
  } catch (error) {
    logger.warn("contact.turnstile_unavailable", { error });
    return false;
  }
}
