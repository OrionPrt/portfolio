/** The admin's pages: the proxy routes these, and only these, under /admin. */
export const ADMIN_PATHS = {
  home: "/admin",
  login: "/admin/login",
  secondFactor: "/admin/login/2fa",
  security: "/admin/security",
} as const;

/** Pages reachable without a full session: the login and its steps. */
export const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set([
  ADMIN_PATHS.login,
  ADMIN_PATHS.secondFactor,
]);

export const KNOWN_ADMIN_PATHS: ReadonlySet<string> = new Set(
  Object.values(ADMIN_PATHS),
);

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PATHS.home || pathname.startsWith(`${ADMIN_PATHS.home}/`)
  );
}
