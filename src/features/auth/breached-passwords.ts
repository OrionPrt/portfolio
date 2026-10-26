import { createHash } from "node:crypto";

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { err, ok, type Result } from "@/lib/result";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 5000;

/**
 * Whether a password appears in Have I Been Pwned's breached passwords. Only
 * the first 5 hex characters of its SHA-1 leave the server (k-anonymity), and
 * padding hides how many suffixes share that prefix.
 */
export async function isBreachedPassword(
  password: string,
  fetchImpl: typeof fetch = fetchWithTimeout(fetch, TIMEOUT_MS),
): Promise<Result<boolean, "unavailable">> {
  const sha1 = createHash("sha1")
    .update(password.normalize("NFC"))
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const response = await fetchImpl(`${RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) {
      return err("unavailable");
    }
    const lines = (await response.text()).split(/\r?\n/);
    return ok(
      lines.some((line) => {
        const [candidate, count] = line.trim().split(":");
        // Padding entries carry a count of 0.
        return candidate === suffix && Number(count) > 0;
      }),
    );
  } catch {
    return err("unavailable");
  }
}
