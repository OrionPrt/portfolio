import "server-only";

import { after } from "next/server";

import type { Database } from "@/db/types";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";

import {
  createAuthDependencies,
  type AuthDependencies,
} from "./auth-dependencies";
import { isBreachedPassword } from "./breached-passwords";
import type { AuthConfig } from "./config";
import { lockoutMail } from "./lockout-mail";

type EnabledAuthConfig = Extract<AuthConfig, { enabled: true }>;

/** The real services behind the sign-in flows, for one database connection. */
export function authDependencies(
  db: Database,
  config: EnabledAuthConfig,
): AuthDependencies {
  const { alertMail } = config;
  return createAuthDependencies(
    db,
    { sealingKey: config.sealingKey, salt: config.ipHashSalt },
    {
      alertLockout: (alert) => {
        if (alertMail === undefined) {
          logger.warn("auth.lockout_alert_skipped");
          return;
        }
        after(() =>
          sendMail({
            mail: alertMail,
            message: lockoutMail(alert),
            event: "auth",
          }),
        );
      },
      isBreached: (password) => isBreachedPassword(password),
      defer: (task) => {
        after(task);
      },
      now: () => new Date(),
    },
  );
}
