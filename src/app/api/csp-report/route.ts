import { parseCspReports } from "@/features/csp-report/parse";
import { clientIp } from "@/lib/client-ip";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { readBodyWithLimit } from "@/lib/read-body";

/** A Reporting API batch is a few KB; anything far larger is not a report. */
const MAX_BODY_BYTES = 64 * 1024;

// In memory, per instance (ADR-0002): reports only feed the logs, so abuse is
// noise, not harm. A page with a broken policy reports a handful of times.
const perClient = createRateLimiter({
  limit: 20,
  windowMs: 60_000,
  maxKeys: 10_000,
});
// Many clients together must not flood the logs either.
const overall = createRateLimiter({ limit: 600, windowMs: 60_000, maxKeys: 1 });

/**
 * Receives Content-Security-Policy violation reports, from both `report-uri`
 * (application/csp-report) and `report-to` (application/reports+json), and
 * logs them. Browsers ignore the answer: it only tells abusers apart.
 */
export async function POST(request: Request): Promise<Response> {
  // Per client first: a noisy client's rejected requests never count overall.
  if (!perClient.allow(clientIp(request.headers)) || !overall.allow("all")) {
    return new Response(null, { status: 429 });
  }
  const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (body === undefined) {
    return new Response(null, { status: 413 });
  }
  const violations = parseCspReports(
    request.headers.get("content-type") ?? "",
    body,
  );
  if (violations === undefined) {
    return new Response(null, { status: 400 });
  }
  for (const violation of violations) {
    logger.warn("csp.violation", { ...violation });
  }
  return new Response(null, { status: 204 });
}
