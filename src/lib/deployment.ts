/**
 * Defaults for development and CI only. A Vercel deployment (production or
 * preview) must set real values, or the features that need them stay off.
 */
export const DEVELOPMENT_IP_HASH_SALT =
  "development-only-salt-not-used-in-production";

/** True on a Vercel deployment, where development defaults are refused. */
export function isVercelDeployment(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production" || vercelEnv === "preview";
}

interface DeploymentEnv {
  readonly VERCEL_ENV?: string | undefined;
  readonly NODE_ENV?: string | undefined;
  readonly ALLOW_DEVELOPMENT_SECRETS?: string | undefined;
}

/**
 * Whether the public development defaults may stand in for missing secrets:
 * in development and tests; in a production build only when explicitly
 * allowed (the E2E server); never on a Vercel deployment. A self-hosted
 * production build therefore fails closed, like Vercel.
 */
export function allowsDevelopmentSecrets(env: DeploymentEnv): boolean {
  if (isVercelDeployment(env.VERCEL_ENV)) {
    return false;
  }
  return (
    env.NODE_ENV !== "production" || env.ALLOW_DEVELOPMENT_SECRETS === "true"
  );
}

/** Seals TOTP secrets in development only: 32 bytes, deliberately public. */
export const DEVELOPMENT_SEALING_KEY = new TextEncoder().encode(
  "development-only-sealing-key-32b",
);
