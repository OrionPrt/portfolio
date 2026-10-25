import { useLocale, useTranslations } from "next-intl";
import { ViewTransition, type ComponentProps } from "react";

import { ViewShell } from "@/components/content/view-shell";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { SocialKind } from "@/features/content/vocabulary";
import type { SocialLinkView } from "@/features/profile/repository";

import { ContactForm } from "./contact-form";

/** The ways to write without the form, which also work without JavaScript. */
const DIRECT_KINDS: readonly SocialKind[] = ["email", "linkedin"];

/** The address or URL as people read it: no scheme, no trailing slash. */
function displayOf(url: string): string {
  return url.replace(/^(mailto:|https?:\/\/(www\.)?)/, "").replace(/\/$/, "");
}

interface ContactViewProps {
  /** Undefined while the anti-abuse services are not configured. */
  readonly form: Omit<ComponentProps<typeof ContactForm>, "action"> | undefined;
  readonly action: ComponentProps<typeof ContactForm>["action"];
  readonly links: readonly SocialLinkView[];
}

/** The contact page: the contact tile morphs into it. */
export function ContactView({ form, action, links }: ContactViewProps) {
  const t = useTranslations("Contact");
  const tKinds = useTranslations("SocialKinds");
  const locale = useLocale();
  const idPrefix = `contact-${locale}`;
  const direct = links.filter((link) => DIRECT_KINDS.includes(link.kind));

  return (
    <ViewTransition
      name={VIEW_TRANSITIONS.contact}
      share="morph"
      default="none"
    >
      <ViewShell
        titleId={`${idPrefix}-title`}
        label={t("label")}
        title={t("title")}
        lead={t("description")}
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="max-w-2xl">
            {form === undefined ? (
              <p className="border-line rounded-control border p-4">
                {t("disabled")}
              </p>
            ) : (
              <ContactForm action={action} {...form} />
            )}
          </div>
          {direct.length > 0 && (
            <section
              aria-labelledby={`${idPrefix}-direct`}
              className="border-line flex flex-col gap-4 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
            >
              <h2
                id={`${idPrefix}-direct`}
                className="text-lg font-semibold tracking-tight"
              >
                {t("direct")}
              </h2>
              <ul className="flex flex-col gap-4">
                {direct.map((link) => (
                  <li key={link.kind} className="flex flex-col gap-1">
                    <span className="text-accent font-mono text-xs">
                      {tKinds(link.kind)}
                    </span>
                    <a
                      href={link.url}
                      rel={
                        link.kind === "email"
                          ? undefined
                          : "noopener noreferrer"
                      }
                      className="hover:text-accent break-all underline underline-offset-4"
                    >
                      {displayOf(link.url)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </ViewShell>
    </ViewTransition>
  );
}
