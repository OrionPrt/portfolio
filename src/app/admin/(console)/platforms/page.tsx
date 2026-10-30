import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PlatformsEditor } from "@/components/admin/content/platforms-editor";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import { createPlatformsAdminRepository } from "@/features/platforms/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.platforms.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.platforms;

export default async function PlatformsPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createPlatformsAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
      {loaded.ok ? (
        <PlatformsEditor platforms={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
