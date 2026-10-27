import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SocialLinksEditor } from "@/components/admin/content/social-links-editor";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import { createSocialLinksAdminRepository } from "@/features/profile/social-links-admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.links.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.links;

export default async function LinksPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createSocialLinksAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
      {loaded.ok ? (
        <SocialLinksEditor links={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
