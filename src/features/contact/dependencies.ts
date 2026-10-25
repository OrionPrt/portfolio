import "server-only";

import { after } from "next/server";

import { withDatabase } from "@/db/client";
import { ok } from "@/lib/result";

import { contactConfig } from "./config";
import { sendContactNotification } from "./notify";
import { createContactRepository } from "./repository";
import {
  createContactRateLimiter,
  type ContactRateLimiter,
} from "./rate-limit";
import type { ContactDependencies } from "./submit";
import { verifyTurnstileToken } from "./turnstile";

// One limiter per instance: the in-memory fallback must outlive a request.
let limiter: ContactRateLimiter | undefined;

/** The real services behind the contact form, from the environment. */
export function contactDependencies(): ContactDependencies {
  const config = contactConfig();
  const shared = (limiter ??= createContactRateLimiter(
    config.enabled ? config.upstash : undefined,
  ));
  return {
    config,
    verifyToken: (token) =>
      config.enabled
        ? verifyTurnstileToken({ token, secretKey: config.turnstile.secretKey })
        : Promise.resolve(false),
    allow: (ipHash) => shared.allow(ipHash),
    store: (message) =>
      withDatabase((db) => createContactRepository(db).create(message)),
    notify: (message) =>
      config.enabled && config.mail !== undefined
        ? sendContactNotification({ message, mail: config.mail })
        : Promise.resolve(ok(undefined)),
    schedule: (task) => {
      after(task);
    },
  };
}
