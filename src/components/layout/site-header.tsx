import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Link } from "@/i18n/navigation";

export function SiteHeader() {
  const t = useTranslations("Layout");

  return (
    <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 pt-6 sm:px-8 lg:px-12">
      <Link
        href="/"
        className="rounded-control flex items-center gap-2.5 font-mono text-sm"
      >
        <span aria-hidden="true" className="bg-signal size-2 rounded-full" />
        <span className="font-medium">orion</span>
        <span aria-hidden="true" className="text-fg-muted">
          ~/portfolio
        </span>
        <span className="sr-only"> — {t("home")}</span>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
