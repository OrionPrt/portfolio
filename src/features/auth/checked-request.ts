import "server-only";

import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";

import { authConfig, type AuthConfig } from "./config";
import { requestContext, type RequestContext } from "./request-context";

export interface CheckedRequest {
  readonly config: Extract<AuthConfig, { enabled: true }>;
  readonly context: RequestContext;
}

/**
 * What every auth and admin action checks before any work: the admin is
 * configured, and the request comes from the site itself. Either problem is
 * logged and reads as unavailable.
 */
export async function checkedRequest(): Promise<
  Result<CheckedRequest, "unavailable">
> {
  const config = authConfig();
  if (!config.enabled) {
    logger.error("auth.not_configured", { missing: config.missing });
    return err("unavailable");
  }
  const context = await requestContext(config.ipHashSalt);
  if (!context.isSameOrigin) {
    logger.warn("auth.cross_origin_refused");
    return err("unavailable");
  }
  return ok({ config, context });
}
