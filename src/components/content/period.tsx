import { useFormatter, useTranslations } from "next-intl";

import { MONTH_YEAR, utcDate } from "@/lib/dates";

interface PeriodProps {
  readonly startedOn: string | null;
  /** Null while it goes on. */
  readonly endedOn: string | null;
}

/** "March 2023 — present", in the reader's language; nothing without a start. */
export function Period({ startedOn, endedOn }: PeriodProps) {
  const format = useFormatter();
  const t = useTranslations("Experiences");
  if (startedOn === null) {
    return null;
  }

  return (
    <span>
      <time dateTime={startedOn}>
        {format.dateTime(utcDate(startedOn), MONTH_YEAR)}
      </time>
      {" — "}
      {endedOn === null ? (
        t("present")
      ) : (
        <time dateTime={endedOn}>
          {format.dateTime(utcDate(endedOn), MONTH_YEAR)}
        </time>
      )}
    </span>
  );
}
