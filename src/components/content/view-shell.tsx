import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Link } from "@/i18n/navigation";

interface ViewShellProps {
  /** Scoped by locale (and slug): other visited views stay mounted, hidden. */
  readonly titleId: string;
  readonly label: string;
  readonly title: ReactNode;
  readonly lead?: ReactNode;
  /** `lang` of the title and lead when they fall back to another language. */
  readonly lang?: string;
  readonly children: ReactNode;
}

/**
 * A full-screen view: the surface a hub tile morphs into, with the way back.
 * Pages wrap it in the <ViewTransition> their tile shares (ADR-0003).
 */
export function ViewShell({
  titleId,
  label,
  title,
  lead,
  lang,
  children,
}: ViewShellProps) {
  const t = useTranslations("View");

  return (
    <article
      aria-labelledby={titleId}
      className="bg-surface border-line rounded-tile flex flex-1 flex-col gap-10 border p-6 sm:p-8 lg:p-12"
    >
      <Link
        href="/"
        className="text-fg-muted hover:text-fg rounded-control self-start font-mono text-xs"
      >
        <span aria-hidden="true">← </span>
        {t("backHome")}
      </Link>
      <header className="flex max-w-4xl flex-col gap-4">
        <Eyebrow>{label}</Eyebrow>
        <h1
          id={titleId}
          lang={lang}
          className="text-[clamp(36px,5vw,64px)] leading-[1.05] font-semibold tracking-[-0.045em]"
        >
          {title}
        </h1>
        {lead !== undefined && (
          <div
            lang={lang}
            className="text-fg-muted max-w-prose text-lg leading-relaxed"
          >
            {lead}
          </div>
        )}
      </header>
      {children}
    </article>
  );
}
