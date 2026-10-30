import { withDatabase } from "@/db/client";
import { cronSecretOf, isCronRequest } from "@/features/retention/cron-auth";
import {
  purgeExpired,
  RETENTION_TARGETS,
  summaryOf,
} from "@/features/retention/purge-repository";
import { logger } from "@/lib/logger";
import { ok } from "@/lib/result";

const NO_STORE = { "cache-control": "no-store" };

/**
 * The daily cron (vercel.json, ADR-0009): deletes what the site no longer
 * keeps. Only a call carrying CRON_SECRET runs it; it answers 500 when a
 * purge failed, so the run shows as failed in Vercel.
 */
export async function GET(request: Request): Promise<Response> {
  // Read first: a GET that reads no request is prerendered at build.
  const authorization = request.headers.get("authorization");
  const secret = cronSecretOf(process.env);
  if (secret === undefined) {
    logger.error("cron.not_configured", { variable: "CRON_SECRET" });
  }
  // Refused alike with no secret set: a caller learns nothing of the setup.
  // Not logged otherwise: anyone may knock, and Vercel's logs count them.
  if (secret === undefined || !isCronRequest(authorization, secret)) {
    return new Response(null, { status: 401, headers: NO_STORE });
  }
  const purged = await withDatabase(async (db) =>
    ok(await purgeExpired(db, new Date())),
  );
  if (!purged.ok) {
    return new Response(null, { status: 503, headers: NO_STORE });
  }
  logger.info("cron.purged", { purged: summaryOf(purged.data) });
  const isComplete = RETENTION_TARGETS.every(
    (target) => purged.data[target] !== undefined,
  );
  return Response.json(
    {
      purged: Object.fromEntries(
        RETENTION_TARGETS.map((target) => [
          target,
          purged.data[target] ?? null,
        ]),
      ),
    },
    { status: isComplete ? 200 : 500, headers: NO_STORE },
  );
}
