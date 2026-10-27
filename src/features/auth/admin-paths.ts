/** The admin's pages: the proxy routes these, and only these, under /admin. */
export const ADMIN_PATHS = {
  home: "/admin",
  login: "/admin/login",
  secondFactor: "/admin/login/2fa",
  security: "/admin/security",
  messages: "/admin/messages",
  profile: "/admin/profile",
  links: "/admin/links",
  skills: "/admin/skills",
  newSkill: "/admin/skills/new",
  projects: "/admin/projects",
  newProject: "/admin/projects/new",
  experiences: "/admin/experiences",
  newExperience: "/admin/experiences/new",
} as const;

/** Pages with a dynamic segment, spelled as their folders: `[id]` is a UUID. */
export const ADMIN_PATTERNS: readonly string[] = [
  "/admin/messages/[id]",
  "/admin/skills/[id]",
  "/admin/projects/[id]",
  "/admin/experiences/[id]",
];

/** Lowercase, as PostgreSQL prints it: an uppercase copy is another URL. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SEGMENT_FORMATS: Readonly<Record<string, RegExp>> = { "[id]": UUID };

export function messagePath(id: string): string {
  return `${ADMIN_PATHS.messages}/${id}`;
}

export function skillPath(id: string): string {
  return `${ADMIN_PATHS.skills}/${id}`;
}

export function projectPath(id: string): string {
  return `${ADMIN_PATHS.projects}/${id}`;
}

export function experiencePath(id: string): string {
  return `${ADMIN_PATHS.experiences}/${id}`;
}

/** Pages reachable without a full session: the login and its steps. */
export const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set([
  ADMIN_PATHS.login,
  ADMIN_PATHS.secondFactor,
]);

export const KNOWN_ADMIN_PATHS: ReadonlySet<string> = new Set(
  Object.values(ADMIN_PATHS),
);

function matchesPattern(pathname: string, pattern: string): boolean {
  const segments = pathname.split("/");
  const expected = pattern.split("/");
  return (
    segments.length === expected.length &&
    expected.every((part, index) => {
      const segment = segments[index] ?? "";
      const format = SEGMENT_FORMATS[part];
      return format === undefined ? segment === part : format.test(segment);
    })
  );
}

/** Whether an admin page answers this path; anything else is a 404. */
export function isKnownAdminPath(pathname: string): boolean {
  return (
    KNOWN_ADMIN_PATHS.has(pathname) ||
    ADMIN_PATTERNS.some((pattern) => matchesPattern(pathname, pattern))
  );
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PATHS.home || pathname.startsWith(`${ADMIN_PATHS.home}/`)
  );
}
