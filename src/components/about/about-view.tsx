import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { Markdown } from "@/components/content/markdown";
import { ViewShell } from "@/components/content/view-shell";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { MediaById } from "@/features/media/types";
import type { ProfileView } from "@/features/profile/repository";

interface AboutViewProps {
  readonly profile: ProfileView;
  /** The library's images the about text shows. */
  readonly images?: MediaById;
}

/** The about page: the identity tile morphs into it. */
export function AboutView({ profile, images }: AboutViewProps) {
  const t = useTranslations("About");
  const tKinds = useTranslations("SocialKinds");
  const locale = useLocale();
  const idPrefix = `about-${locale}`;
  const lang = profile.isFallback ? profile.contentLocale : undefined;
  const facts = [
    ["availability", profile.availability],
    ["location", profile.location],
    ["lookingFor", profile.lookingFor],
  ] as const;

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.identity}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={t("label")}
        title={profile.displayName}
        lead={profile.headline}
        lang={lang}
      >
        <div lang={lang} className="flex max-w-prose flex-col gap-6">
          <p className="text-lg leading-relaxed">{profile.pitch}</p>
          {profile.aboutMd.trim() !== "" && (
            <Markdown source={profile.aboutMd} topLevel={2} images={images} />
          )}
        </div>
        <dl className="grid gap-6 sm:grid-cols-3">
          {facts.map(
            ([key, value]) =>
              value !== null && (
                <div
                  key={key}
                  className="border-line flex flex-col gap-2 border-t pt-4"
                >
                  <dt className="text-accent font-mono text-xs">{t(key)}</dt>
                  <dd lang={lang} className="leading-relaxed">
                    {value}
                  </dd>
                </div>
              ),
          )}
        </dl>
        {profile.socialLinks.length > 0 && (
          <section
            aria-labelledby={`${idPrefix}-links`}
            className="mt-auto flex flex-col gap-3"
          >
            <h2
              id={`${idPrefix}-links`}
              className="text-lg font-semibold tracking-tight"
            >
              {t("links")}
            </h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {profile.socialLinks.map((link) => (
                <li key={link.kind}>
                  <a
                    href={link.url}
                    rel={
                      link.kind === "email" ? undefined : "noopener noreferrer"
                    }
                    className="hover:text-accent underline underline-offset-4"
                  >
                    {tKinds(link.kind)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </ViewShell>
    </ViewTransition>
  );
}
