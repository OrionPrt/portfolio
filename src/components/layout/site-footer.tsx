import { useTranslations } from "next-intl";

const SOURCE_URL = "https://github.com/OrionPrt/portfolio";

interface SiteFooterProps {
  readonly year: number;
}

export function SiteFooter({ year }: SiteFooterProps) {
  const t = useTranslations("Layout");

  return (
    <footer className="text-fg-muted mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 pb-6 font-mono text-xs sm:px-8 lg:px-12">
      <span>{t("footerRights", { year })}</span>
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-fg inline-flex min-h-6 items-center underline-offset-4 hover:underline"
      >
        {t("footerSource")}
      </a>
    </footer>
  );
}
