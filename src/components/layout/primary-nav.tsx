"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

const SECTIONS = [
  ["/projects", "projects"],
  ["/experiences", "experiences"],
  ["/journey", "journey"],
  ["/skills", "skills"],
  ["/about", "about"],
  ["/contact", "contact"],
] as const;

/** The site's sections; the current one (or its parent) is marked for assistive tech. */
export function PrimaryNav() {
  const t = useTranslations("Nav");
  // The internal route, e.g. "/projects/[slug]", whatever the language.
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {SECTIONS.map(([href, key]) => {
          const isPage = pathname === href;
          const isSection = isPage || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                // "page" on the section itself, "true" on its detail pages.
                aria-current={isPage ? "page" : isSection ? "true" : undefined}
                className={`rounded-control inline-flex min-h-6 items-center underline-offset-4 hover:underline ${
                  isSection
                    ? "text-fg font-medium underline"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
