import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProfileForm } from "@/components/admin/content/profile-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { requireAdmin } from "@/features/auth/dal";
import { loadMediaOptions } from "@/features/media/media-options";
import { createProfileAdminRepository } from "@/features/profile/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.profile.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.profile;

export default async function ProfilePage() {
  await requireAdmin();
  const [loaded, media] = await Promise.all([
    withDatabase((db) => createProfileAdminRepository(db).read()),
    withDatabase(loadMediaOptions),
  ]);

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose">{COPY.lead}</p>
      {loaded.ok && media.ok ? (
        <ProfileForm profile={loaded.data} media={media.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
