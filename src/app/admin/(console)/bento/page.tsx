import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BentoForm } from "@/components/admin/content/bento-editor";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import { createBentoAdminRepository } from "@/features/bento/admin-repository";
import { tilesWithoutContent } from "@/features/bento/tile-content";
import {
  getCertifications,
  getEducation,
  getSkills,
} from "@/features/catalog/queries";
import { getCurrentExperience } from "@/features/experiences/queries";
import { getProfile } from "@/features/profile/queries";
import { getLatestPost } from "@/features/posts/queries";
import { getFeaturedProject } from "@/features/projects/queries";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { all } from "@/lib/result";

export const metadata: Metadata = { title: ADMIN_COPY.bento.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.bento;

/**
 * The tiles with nothing to show, read as the hub reads them (the same cached
 * queries). When a read fails, none is assumed empty: the preview then shows
 * every tile left visible rather than hide one wrongly.
 */
async function loadEmptyKinds() {
  const reads = await Promise.all([
    getProfile(DEFAULT_LOCALE),
    getFeaturedProject(DEFAULT_LOCALE),
    getCurrentExperience(DEFAULT_LOCALE),
    getSkills(),
    getEducation(DEFAULT_LOCALE),
    getCertifications(DEFAULT_LOCALE),
    getLatestPost(DEFAULT_LOCALE),
  ]);
  const content = all(reads);
  if (!content.ok) {
    return [];
  }
  const [
    profile,
    featuredProject,
    currentExperience,
    skills,
    education,
    certifications,
    latestPost,
  ] = content.data;
  return tilesWithoutContent({
    profile,
    featuredProject,
    currentExperience,
    skills,
    education,
    certifications,
    latestPost,
  });
}

export default async function BentoPage() {
  await requireAdmin();
  const [layout, emptyKinds] = await Promise.all([
    withDatabase((db) => createBentoAdminRepository(db).layout()),
    loadEmptyKinds(),
  ]);

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
      {layout.ok ? (
        <BentoForm layout={layout.data} emptyKinds={emptyKinds} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
