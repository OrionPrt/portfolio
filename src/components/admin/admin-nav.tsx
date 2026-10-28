"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_PATHS } from "@/features/auth/admin-paths";

import { ADMIN_COPY } from "./copy";

const NAV = ADMIN_COPY.nav;

interface NavItem {
  readonly href: string;
  readonly label: string;
}

const GROUPS: readonly {
  readonly id: string;
  readonly title: string;
  readonly items: readonly NavItem[];
}[] = [
  {
    id: "admin-nav-overview",
    title: NAV.groups.overview,
    items: [
      { href: ADMIN_PATHS.home, label: NAV.dashboard },
      { href: ADMIN_PATHS.messages, label: NAV.messages },
    ],
  },
  {
    id: "admin-nav-content",
    title: NAV.groups.content,
    items: [
      { href: ADMIN_PATHS.profile, label: NAV.profile },
      { href: ADMIN_PATHS.links, label: NAV.links },
      { href: ADMIN_PATHS.projects, label: NAV.projects },
      { href: ADMIN_PATHS.experiences, label: NAV.experiences },
      { href: ADMIN_PATHS.education, label: NAV.education },
      { href: ADMIN_PATHS.certifications, label: NAV.certifications },
      { href: ADMIN_PATHS.skills, label: NAV.skills },
      { href: ADMIN_PATHS.media, label: NAV.media },
    ],
  },
  {
    id: "admin-nav-account",
    title: NAV.groups.account,
    items: [{ href: ADMIN_PATHS.security, label: NAV.security }],
  },
];

export const NAV_LINK_CLASSES =
  "rounded-control text-fg-muted hover:text-fg hover:bg-surface-muted aria-[current]:bg-surface-muted aria-[current]:text-fg flex min-h-10 items-center gap-2 px-3 text-sm aria-[current]:font-medium";

/** "page" on the section's own page, "true" on a page inside it (a message). */
function currentOf(
  href: string,
  pathname: string,
): "page" | "true" | undefined {
  if (pathname === href) {
    return "page";
  }
  return href !== ADMIN_PATHS.home && pathname.startsWith(`${href}/`)
    ? "true"
    : undefined;
}

/** The count, visible, then in words for screen readers: "Messages 3 non lus". */
function UnreadBadge({ count }: { readonly count: number }) {
  return (
    <span className="bg-accent/15 text-fg ml-auto rounded-full px-2 font-mono text-xs">
      {count} <span className="sr-only">{NAV.unreadWord(count)}</span>
    </span>
  );
}

interface AdminNavProps {
  /** Unread messages; undefined when they could not be counted. */
  readonly unread: number | undefined;
}

/** The sections of the admin, grouped; the current one is marked. */
export function AdminNav({ unread }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={NAV.label}
      className="flex flex-wrap gap-x-6 gap-y-4 lg:flex-col"
    >
      {GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-1">
          <p id={group.id} className="text-fg-muted px-3 font-mono text-xs">
            {group.title}
          </p>
          {/* role="list": Safari drops list semantics once list-style is none. */}
          <ul
            role="list"
            aria-labelledby={group.id}
            className="flex flex-wrap gap-1 lg:flex-col"
          >
            {group.items.map((item) => {
              const count =
                item.href === ADMIN_PATHS.messages ? (unread ?? 0) : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={currentOf(item.href, pathname)}
                    className={NAV_LINK_CLASSES}
                  >
                    {/* Spaces between the parts, for the link's name. */}
                    {item.label} {count > 0 && <UnreadBadge count={count} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
