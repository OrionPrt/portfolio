import { useTranslations } from "next-intl";

/** Shown in place of content when the database could not be read (DB_UNAVAILABLE). */
export function DataUnavailable() {
  const t = useTranslations("DataUnavailable");

  return (
    <div
      role="status"
      className="border-line bg-surface rounded-tile flex flex-col gap-1 border border-dashed p-5"
    >
      <p className="font-medium">{t("title")}</p>
      <p className="text-fg-muted text-sm">{t("description")}</p>
    </div>
  );
}
