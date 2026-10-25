import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ContactView } from "@/components/contact/contact-view";
import { submitContact } from "@/features/contact/actions";
import { contactConfig } from "@/features/contact/config";
import { getProfile } from "@/features/profile/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Contact" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localizedAlternates(locale, "/contact"),
  };
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

export default async function ContactPage({
  params,
}: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Cloudflare's script is signed with this request's nonce (ADR-0002).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const config = contactConfig();
  const profile = await getProfile(locale);
  // Without a profile (or a database), the form still stands on its own.
  const links = profile.ok ? (profile.data?.socialLinks ?? []) : [];

  return (
    <ContactView
      form={
        config.enabled
          ? { siteKey: config.turnstile.siteKey, nonce }
          : undefined
      }
      action={submitContact}
      links={links}
    />
  );
}
