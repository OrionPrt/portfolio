import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Period } from "@/components/content/period";
import { MediaImage } from "@/components/ui/media-image";
import type {
  CertificationView,
  EducationView,
} from "@/features/catalog/repository";
import type { MediaView } from "@/features/media/types";
import type { PlatformView } from "@/features/platforms/repository";
import { DAY_MONTH_YEAR, MONTH_YEAR, utcDate } from "@/lib/dates";

const ITEM_CLASSES = "border-line flex gap-4 border-t pt-5";

interface EmblemProps {
  readonly image: MediaView | undefined;
  /** Whether another item of the section has one: this one keeps its room. */
  readonly hasImages: boolean;
}

/** A logo or badge beside its entry, on a light plate, or the room it would take. */
function Emblem({ image, hasImages }: EmblemProps) {
  if (image === undefined) {
    return hasImages ? (
      <span aria-hidden="true" className="hidden size-12 shrink-0 sm:block" />
    ) : null;
  }
  return (
    // Its name is beside it: the logo or badge adorns the name.
    <MediaImage
      image={image}
      alt=""
      sizes="48px"
      className="border-line rounded-control size-12 shrink-0 border bg-white object-contain p-1"
    />
  );
}

interface ItemProps<T> {
  readonly entry: T;
  /** Whether an item of the section has an image: all keep its room then. */
  readonly hasImages: boolean;
}

interface SectionProps {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}

export function JourneySection({ id, title, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ul role="list" className="flex flex-col gap-5">
        {children}
      </ul>
    </section>
  );
}

export function EducationItem({ entry, hasImages }: ItemProps<EducationView>) {
  const lang = entry.isFallback ? entry.contentLocale : undefined;
  return (
    <li className={ITEM_CLASSES}>
      <Emblem image={entry.logo} hasImages={hasImages} />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 lang={lang} className="font-semibold wrap-anywhere">
          {entry.degree}
        </h3>{" "}
        <p className="text-fg-muted text-sm">
          {entry.school}
          {entry.location !== null && ` · ${entry.location}`}
          {" · "}
          <Period startedOn={entry.startedOn} endedOn={entry.endedOn} />
        </p>{" "}
        {entry.description !== "" && (
          <p lang={lang} className="max-w-prose leading-relaxed">
            {entry.description}
          </p>
        )}
      </div>
    </li>
  );
}

export function CertificationItem({
  entry,
  hasImages,
}: ItemProps<CertificationView>) {
  const t = useTranslations("Journey");
  const format = useFormatter();
  const month = (day: string) => format.dateTime(utcDate(day), MONTH_YEAR);
  return (
    <li className={ITEM_CLASSES}>
      <Emblem image={entry.badge} hasImages={hasImages} />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold wrap-anywhere">{entry.name}</h3>{" "}
        <p className="text-fg-muted text-sm">
          {entry.issuer}
          {" · "}
          {t("issued", { date: month(entry.issuedOn) })}
          {entry.expiresOn !== null && (
            <>
              {" · "}
              <span className={entry.isExpired ? "text-warning" : undefined}>
                {t(entry.isExpired ? "expired" : "expires", {
                  date: month(entry.expiresOn),
                })}
              </span>
            </>
          )}
        </p>{" "}
        {entry.description !== "" && (
          <p
            lang={entry.isFallback ? entry.contentLocale : undefined}
            className="max-w-prose leading-relaxed"
          >
            {entry.description}
          </p>
        )}{" "}
        {(entry.credentialId !== null || entry.verifyUrl !== null) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            {entry.credentialId !== null && (
              <span className="text-fg-muted wrap-anywhere">
                {t("credentialId", { id: entry.credentialId })}
              </span>
            )}{" "}
            {entry.verifyUrl !== null && (
              <a
                href={entry.verifyUrl}
                rel="noopener noreferrer"
                aria-label={t("verifyLabel", { name: entry.name })}
                className="inline-flex min-h-6 items-center underline underline-offset-4"
              >
                {t("verify")}
              </a>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

export function PlatformItem({ entry }: { readonly entry: PlatformView }) {
  const t = useTranslations("Journey");
  const format = useFormatter();
  return (
    <li className="border-line flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t pt-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="font-semibold wrap-anywhere">
          {entry.profileUrl === null ? (
            entry.name
          ) : (
            <a
              href={entry.profileUrl}
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {entry.name}
            </a>
          )}
        </h3>{" "}
        <p className="text-fg-muted text-sm">
          {entry.rank !== null && `${entry.rank} · `}
          {t("readOn", {
            date: format.dateTime(utcDate(entry.updatedOn), DAY_MONTH_YEAR),
          })}
        </p>
      </div>{" "}
      {entry.points !== null && (
        <p className="text-accent font-mono text-sm">
          {t("points", { points: entry.points })}
        </p>
      )}
    </li>
  );
}
