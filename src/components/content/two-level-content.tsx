import { useTranslations } from "next-intl";

import type { StorySummary } from "@/features/content/types";
import type { MediaById } from "@/features/media/types";

import { Markdown } from "./markdown";

interface TwoLevelContentProps {
  /** Scopes heading ids: other locales' copies of the page stay mounted. */
  readonly idPrefix: string;
  readonly summary: StorySummary;
  readonly technicalMd: string;
  /** `lang` of the stored text when it falls back to another language. */
  readonly lang?: string;
  /** The library's images the technical text shows. */
  readonly images?: MediaById;
}

/**
 * The two reading levels of a project or experience: the essentials for
 * everyone, then the technical details, folded in a native <details> that
 * opens with or without JavaScript and announces its state on its own.
 */
export function TwoLevelContent({
  idPrefix,
  summary,
  technicalMd,
  lang,
  images,
}: TwoLevelContentProps) {
  const t = useTranslations("TwoLevel");
  const essentialsId = `${idPrefix}-essentials`;
  const steps = [
    ["context", summary.context],
    ["action", summary.action],
    ["result", summary.result],
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={essentialsId} className="flex flex-col gap-5">
        <h2 id={essentialsId} className="text-xl font-semibold tracking-tight">
          {t("essentials")}
        </h2>
        <dl className="grid gap-5 md:grid-cols-3">
          {steps.map(([key, text]) => (
            <div
              key={key}
              className="border-line flex flex-col gap-2 border-t pt-4"
            >
              <dt className="text-accent font-mono text-xs">{t(key)}</dt>
              <dd lang={lang} className="leading-relaxed">
                {text}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {technicalMd.trim() !== "" && (
        <details className="group border-line rounded-tile border">
          <summary className="hover:bg-surface-muted rounded-tile flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("technical")}
            </h2>
            <span
              aria-hidden="true"
              className="text-fg-muted font-mono text-sm transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div lang={lang} className="border-line border-t p-5">
            <Markdown source={technicalMd} images={images} />
          </div>
        </details>
      )}
    </div>
  );
}
