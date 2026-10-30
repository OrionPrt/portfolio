import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { BentoHub, FALLBACK_TILES } from "@/components/bento/bento-hub";
import { DataUnavailable } from "@/components/content/data-unavailable";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getBentoTiles,
  getCertifications,
  getEducation,
  getSkills,
} from "@/features/catalog/queries";
import { getCurrentExperience } from "@/features/experiences/queries";
import { getProfile } from "@/features/profile/queries";
import { getFeaturedProject } from "@/features/projects/queries";
import { localizedAlternates } from "@/features/seo/alternates";
import { personJsonLd } from "@/features/seo/json-ld";
import { siteUrl } from "@/features/seo/site-url";
import { getPlatforms } from "@/features/platforms/queries";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { unwrapOr } from "@/lib/result";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? { alternates: localizedAlternates(locale, "/") }
    : {};
}

// Blocking render, like every page (ADR-0002, ADR-0003).
export const instant = false;

/** The bento hub (ADR-0003): every tile reads cached, tagged data (ADR-0004). */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  // A page renders alongside its layout: it checks the locale itself.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const reads = await Promise.all([
    getBentoTiles(),
    getProfile(locale),
    getFeaturedProject(locale),
    getCurrentExperience(locale),
    getSkills(),
    getEducation(locale),
    getCertifications(locale),
    getPlatforms(),
  ]);
  const [
    tiles,
    profile,
    featuredProject,
    currentExperience,
    skills,
    education,
    certifications,
    platforms,
  ] = reads;

  const owner = unwrapOr(profile, undefined);

  return (
    <div className="flex flex-1 flex-col gap-3">
      {owner !== undefined && (
        <JsonLd
          data={personJsonLd({
            name: owner.displayName,
            jobTitle: owner.headline,
            description: owner.pitch,
            url: new URL(getPathname({ locale, href: "/" }), siteUrl()).href,
            links: owner.socialLinks,
          })}
        />
      )}
      {reads.some((read) => !read.ok) && <DataUnavailable />}
      <BentoHub
        data={{
          tiles: unwrapOr(tiles, FALLBACK_TILES),
          profile: owner,
          featuredProject: unwrapOr(featuredProject, undefined),
          currentExperience: unwrapOr(currentExperience, undefined),
          skills: unwrapOr(skills, []),
          education: unwrapOr(education, []),
          certifications: unwrapOr(certifications, []),
          platforms: unwrapOr(platforms, []),
        }}
      />
    </div>
  );
}
