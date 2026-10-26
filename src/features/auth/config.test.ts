import { describe, expect, it } from "vitest";

import { DEVELOPMENT_SEALING_KEY } from "@/lib/deployment";

import { authConfig } from "./config";

const KEY = Buffer.alloc(32, 7);
const PRODUCTION = {
  VERCEL_ENV: "production",
  TOTP_ENCRYPTION_KEY: KEY.toString("base64"),
  IP_HASH_SALT: "s".repeat(32),
  RESEND_API_KEY: "re_1",
  CONTACT_TO_EMAIL: "prieto.orion@gmail.com",
};

describe("authConfig", () => {
  it("runs on development secrets outside Vercel", () => {
    expect(authConfig({})).toMatchObject({
      enabled: true,
      sealingKey: DEVELOPMENT_SEALING_KEY,
      alertMail: undefined,
    });
  });

  it("uses the real key and salt on Vercel, and alerts the owner", () => {
    expect(authConfig(PRODUCTION)).toEqual({
      enabled: true,
      sealingKey: new Uint8Array(KEY),
      ipHashSalt: "s".repeat(32),
      alertMail: {
        apiKey: "re_1",
        to: "prieto.orion@gmail.com",
        from: "Portfolio <onboarding@resend.dev>",
      },
    });
  });

  it.each(["production", "preview"])(
    "turns the admin off on %s while a secret is missing",
    (environment) => {
      expect(authConfig({ VERCEL_ENV: environment })).toEqual({
        enabled: false,
        missing: ["TOTP_ENCRYPTION_KEY", "IP_HASH_SALT"],
      });
    },
  );

  it("fails closed in any production build, Vercel or not", () => {
    expect(authConfig({ NODE_ENV: "production" })).toEqual({
      enabled: false,
      missing: ["TOTP_ENCRYPTION_KEY", "IP_HASH_SALT"],
    });
  });

  it("runs a production build on development secrets only when told to (E2E)", () => {
    expect(
      authConfig({ NODE_ENV: "production", ALLOW_DEVELOPMENT_SECRETS: "true" }),
    ).toMatchObject({ enabled: true, sealingKey: DEVELOPMENT_SEALING_KEY });
    expect(
      authConfig({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
        ALLOW_DEVELOPMENT_SECRETS: "true",
      }),
    ).toMatchObject({ enabled: false });
  });

  it("refuses the development key on Vercel", () => {
    expect(
      authConfig({
        ...PRODUCTION,
        TOTP_ENCRYPTION_KEY: Buffer.from(DEVELOPMENT_SEALING_KEY).toString(
          "base64",
        ),
      }),
    ).toEqual({ enabled: false, missing: ["TOTP_ENCRYPTION_KEY"] });
  });
});
