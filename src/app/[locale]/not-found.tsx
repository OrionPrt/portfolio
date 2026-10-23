import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <section className="flex flex-1 flex-col items-start justify-center gap-4 py-16">
      <p className="text-accent font-mono text-xs">
        <span aria-hidden="true">{"// "}</span>404
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-fg-muted max-w-prose">{t("description")}</p>
      <Link
        href="/"
        className="bg-fg text-ground rounded-control inline-flex h-10 items-center px-4 text-sm font-medium"
      >
        {t("home")}
      </Link>
    </section>
  );
}
