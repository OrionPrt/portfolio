import { useFormatter, useTranslations } from "next-intl";

import { MONTH_YEAR, utcDate, YEAR } from "@/lib/dates";

interface PeriodProps {
  readonly startedOn: string | null;
  /** Null while it goes on. */
  readonly endedOn: string | null;
  /** Years only, where months would not fit: "2023 — present". */
  readonly isYearOnly?: boolean;
}

/** "March 2023 — present", in the reader's language; nothing without a start. */
export function Period({
  startedOn,
  endedOn,
  isYearOnly = false,
}: PeriodProps) {
  const options = isYearOnly ? YEAR : MONTH_YEAR;
  const format = useFormatter();
  const t = useTranslations("Experiences");
  if (startedOn === null) {
    return null;
  }
  // "2023", not "2023 — 2023": the year alone says it.
  if (isYearOnly && endedOn?.slice(0, 4) === startedOn.slice(0, 4)) {
    return (
      <time dateTime={startedOn}>
        {format.dateTime(utcDate(startedOn), options)}
      </time>
    );
  }

  return (
    <span>
      <time dateTime={startedOn}>
        {format.dateTime(utcDate(startedOn), options)}
      </time>
      {" — "}
      {endedOn === null ? (
        t("present")
      ) : (
        <time dateTime={endedOn}>
          {format.dateTime(utcDate(endedOn), options)}
        </time>
      )}
    </span>
  );
}
