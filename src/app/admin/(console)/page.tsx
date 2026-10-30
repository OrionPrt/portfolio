import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ADMIN_COPY } from "@/components/admin/copy";
import {
  ActivitySection,
  MediaPanel,
  PlatformsPanel,
  ToDoSection,
} from "@/components/admin/dashboard-sections";
import { withDatabase } from "@/db/client";
import { createDashboardRepository } from "@/features/admin/dashboard-repository";
import { createAuditRepository } from "@/features/auth/audit-repository";
import { requireAdmin } from "@/features/auth/dal";
import { getUnreadCount } from "@/features/contact/inbox-queries";
import { createPlatformsAdminRepository } from "@/features/platforms/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.dashboard.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.dashboard;

/** The latest events shown; the security page pages through the rest. */
const ACTIVITY_SIZE = 8;

/** Each part reads on its own: one failing leaves the others shown. */
export default async function AdminHomePage() {
  await requireAdmin();
  const [unread, content, media, platforms, activity] = await Promise.all([
    getUnreadCount(),
    withDatabase((db) => createDashboardRepository(db).contentToDo()),
    withDatabase((db) => createDashboardRepository(db).media()),
    withDatabase((db) => createPlatformsAdminRepository(db).list()),
    withDatabase((db) =>
      createAuditRepository(db).list({ limit: ACTIVITY_SIZE, offset: 0 }),
    ),
  ]);

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <p className="text-fg-muted max-w-prose text-lg leading-relaxed">
        {COPY.lead}
      </p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <ToDoSection unread={unread} content={content} />
        <div className="flex flex-col gap-4">
          <MediaPanel media={media} />
          <PlatformsPanel platforms={platforms} />
        </div>
      </div>
      <ActivitySection activity={activity} />
    </>
  );
}
